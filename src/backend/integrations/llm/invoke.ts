/**
 * Purpose: Invoke configured chat models and return normalized text, usage, and diagnostics.
 * Pattern: Integration adapter.
 * Usage: Called by backend workflows for prose, streaming text, and exact choices.
 * Related: src/backend/integrations/llm/model-factory.ts, src/backend/integrations/llm/stream.ts
 */
import { exactChoiceMessages } from "./prompts/exact-choice"
import type {
  ActorCardStep,
  ActorTraceStep,
  CoordinatorTraceStep,
  GeneratorRosterStep,
  LLMSettings,
  ModelMetrics,
  ModelRole,
  ObserverTraceStep,
  PlannerTraceStep,
  ResolvedRoleSettings,
} from "@/shared"
import { resolveRoleSettings } from "@/backend/core/settings"
import { createChatModel } from "@/backend/integrations/llm/model-factory"
import { collectModelStream, DEFAULT_RESPONSE_BYTE_LIMIT } from "./stream"
import type { ChatInput } from "@/backend/integrations/llm/types"
import { currentModelExecution, modelResourcePool } from "./execution-context"

export interface RoleInvocationOptions {
  maxOutputTokens?: number
  maxResponseBytes?: number
  signal?: AbortSignal
  onAdmission?: (status: "waiting" | "running") => Promise<void>
  taskId?: string
}

const EXACT_CHOICE_OUTPUT_TOKENS = 2_048
const TRUNCATED_FINISH_REASONS = new Set(["length", "max_tokens", "MAX_TOKENS"])

export interface RoleTextResult {
  text: string
  metrics: ModelMetrics
  diagnostics: {
    reasoningContentObserved: boolean
    reasoningContent: string
    finishReason?: string
  }
}

export type RoleTextStep =
  | ActorTraceStep
  | PlannerTraceStep
  | CoordinatorTraceStep
  | ObserverTraceStep
  | GeneratorRosterStep
  | ActorCardStep
  | "actionCatalog"
  | "eventAudience"
  | "reportCommentary"
  | "draft"

export async function invokeRoleText(
  settings: LLMSettings,
  role: ModelRole,
  prompt: string
): Promise<string> {
  return (await invokeRoleTextWithMetrics(settings, role, "draft", 1, prompt)).text
}

export async function invokeRoleTextStreaming(
  settings: LLMSettings,
  role: ModelRole,
  step: RoleTextStep,
  attempt: number,
  prompt: string,
  onDelta: (text: string) => Promise<void> | void,
  options: RoleInvocationOptions = {}
): Promise<RoleTextResult> {
  return invokeRoleTextWithMetrics(settings, role, step, attempt, prompt, onDelta, options)
}

export async function invokeRoleTextWithMetrics(
  settings: LLMSettings,
  role: ModelRole,
  step: RoleTextStep,
  attempt: number,
  prompt: string,
  onDelta?: (text: string) => Promise<void> | void,
  options: RoleInvocationOptions = {}
): Promise<RoleTextResult> {
  return invokeRoleInputWithMetrics(settings, role, step, attempt, prompt, onDelta, options)
}

export async function invokeRoleInputWithMetrics(
  settings: LLMSettings,
  role: ModelRole,
  step: RoleTextStep,
  attempt: number,
  input: ChatInput,
  onDelta?: (text: string) => Promise<void> | void,
  options: RoleInvocationOptions = {}
): Promise<RoleTextResult> {
  const config = applyInvocationBudget(resolveRoleSettings(settings, role), options)
  return invokeConfiguredInput(config, role, step, attempt, input, onDelta, options)
}

export async function invokeExactChoiceWithMetrics(
  settings: LLMSettings,
  role: ModelRole,
  step: RoleTextStep,
  attempt: number,
  prompt: string,
  allowedOutputs: string[],
  options: RoleInvocationOptions = {}
): Promise<RoleTextResult> {
  const outputs = exactChoiceOutputs(allowedOutputs)
  return invokeConfiguredInput(
    applyInvocationBudget(buildExactChoiceSettings(settings, role), options),
    role,
    step,
    attempt,
    exactChoiceMessages(prompt, outputs),
    undefined,
    options
  )
}

export function buildExactChoiceSettings(settings: LLMSettings, role: ModelRole): ResolvedRoleSettings {
  const config = resolveRoleSettings(settings, role)
  const exactConfig = { ...config }
  delete exactConfig.reasoningEffort
  const exactExtraBody = buildExactChoiceExtraBody(config.provider, config.extraBody)
  return {
    ...exactConfig,
    temperature: 0,
    maxTokens: Math.min(config.maxTokens, EXACT_CHOICE_OUTPUT_TOKENS),
    extraBody: exactExtraBody,
  }
}


export function exactChoiceOutputs(allowedOutputs: readonly string[]): string[] {
  if (!allowedOutputs.length) {
    throw new Error("Exact-choice invocation requires at least one allowed output.")
  }
  const outputs = allowedOutputs.map((output) => output.trim())
  if (outputs.some((output) => !output)) {
    throw new Error("Exact-choice outputs must be non-empty strings.")
  }
  if (new Set(outputs).size !== outputs.length) {
    throw new Error("Exact-choice outputs must be distinct.")
  }
  return outputs
}

export function reasoningOnlyWarning(result: RoleTextResult): string | undefined {
  if (!result.diagnostics.reasoningContentObserved || result.text.trim()) {
    return undefined
  }
  return result.diagnostics.finishReason === "length"
    ? "model returned reasoning content without assistant content; finish_reason=length suggests the completion budget was exhausted before final content."
    : "model returned reasoning content without assistant content."
}

async function invokeConfiguredInput(
  config: ResolvedRoleSettings,
  role: ModelRole,
  step: RoleTextStep,
  attempt: number,
  input: ChatInput,
  onDelta?: (text: string) => Promise<void> | void,
  options: RoleInvocationOptions = {}
): Promise<RoleTextResult> {
  const execution = currentModelExecution()
  const signals = [execution?.signal, options.signal].filter((signal): signal is AbortSignal => !!signal)
  const signal = signals.length ? AbortSignal.any(signals) : undefined
  signal?.throwIfAborted()
  execution?.assertActive?.()
  if (execution) await options.onAdmission?.("waiting")
  const queuedAt = performance.now()
  const release = await execution?.admission.acquire(modelResourcePool(config), execution.owner, signal)
  const queueWaitMs = Math.max(0, Math.round(performance.now() - queuedAt))
  try {
    signal?.throwIfAborted()
    execution?.assertActive?.()
    if (execution) await options.onAdmission?.("running")
    const model = createChatModel(config)
    let result: Awaited<ReturnType<typeof collectModelStream>>
    try {
      result = await collectModelStream(model, input, {
        timeoutMs: config.timeoutSeconds * 1000,
        maxResponseBytes: options.maxResponseBytes ?? DEFAULT_RESPONSE_BYTE_LIMIT,
        signal,
        onDelta,
      })
    } catch (error) {
      await execution?.onModelCallFailure?.({ role, step, attempt, taskId: options.taskId,
        outcome: signal?.aborted ? "canceled" : "failed", queueWaitMs })
      throw error
    }
    return {
      text: result.text,
      metrics: { role, step, attempt, ttftMs: result.ttftMs, durationMs: result.durationMs,
        queueWaitMs, ...result.usage, tokenSource: result.tokenSource },
      diagnostics: result.diagnostics,
    }
  } finally { release?.() }
}

export function applyInvocationBudget(config: ResolvedRoleSettings, options: RoleInvocationOptions): ResolvedRoleSettings {
  const maximum = options.maxOutputTokens ?? config.maxTokens
  if (!Number.isSafeInteger(maximum) || maximum < 1) throw new Error("Output token limit must be a positive integer.")
  return { ...config, maxTokens: Math.min(config.maxTokens, maximum) }
}

export function assertCompleteModelOutput(result: RoleTextResult): void {
  if (modelOutputTruncated(result)) {
    throw new Error("Model output was truncated; generate a smaller complete response.")
  }
}

export function modelOutputTruncated(result: RoleTextResult): boolean {
  return !!result.diagnostics.finishReason && TRUNCATED_FINISH_REASONS.has(result.diagnostics.finishReason)
}

function buildExactChoiceExtraBody(
  provider: ResolvedRoleSettings["provider"],
  extraBody: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const rest = { ...(extraBody ?? {}) }
  delete rest.reasoning_effort
  if (provider === "lmstudio") {
    return { ...rest, reasoning_effort: "none" }
  }
  return Object.keys(rest).length ? rest : undefined
}
