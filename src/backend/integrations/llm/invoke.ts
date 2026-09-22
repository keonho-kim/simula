/**
 * Purpose: Invoke configured chat models and return normalized text, usage, and diagnostics.
 * Pattern: Integration adapter.
 * Usage: Called by backend workflows for prose, streaming text, and exact choices.
 * Related: src/backend/integrations/llm/model-factory.ts, src/backend/integrations/llm/usage.ts
 */
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
import { contentToText } from "@/backend/integrations/llm/content"
import { createChatModel } from "@/backend/integrations/llm/model-factory"
import { readUsage, zeroUsage } from "@/backend/integrations/llm/usage"
import type { ChatInput, TokenUsage } from "@/backend/integrations/llm/types"

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
  onDelta: (text: string) => Promise<void> | void
): Promise<RoleTextResult> {
  return invokeRoleTextWithMetrics(settings, role, step, attempt, prompt, onDelta)
}

export async function invokeRoleTextWithMetrics(
  settings: LLMSettings,
  role: ModelRole,
  step: RoleTextStep,
  attempt: number,
  prompt: string,
  onDelta?: (text: string) => Promise<void> | void
): Promise<RoleTextResult> {
  const config = resolveRoleSettings(settings, role)
  return invokeRoleInputWithMetrics(config, role, step, attempt, prompt, onDelta)
}

export async function invokeExactChoiceWithMetrics(
  settings: LLMSettings,
  role: ModelRole,
  step: RoleTextStep,
  attempt: number,
  prompt: string,
  allowedOutputs: string[]
): Promise<RoleTextResult> {
  const outputs = exactChoiceOutputs(allowedOutputs)
  return invokeRoleInputWithMetrics(
    buildExactChoiceSettings(settings, role),
    role,
    step,
    attempt,
    exactChoiceMessages(prompt, outputs)
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
    maxTokens: 64,
    extraBody: exactExtraBody,
  }
}

export function exactChoiceMessages(prompt: string, allowedOutputs: string[]): ChatInput {
  const outputs = exactChoiceOutputs(allowedOutputs)
  return [
    {
      role: "system",
      content:
        "You are an exact-choice classifier. Do not reason. Answer immediately in assistant content with exactly one allowed output. No markdown, labels, punctuation, or explanation.",
    },
    {
      role: "user",
      content: `${prompt}

Allowed outputs:
${outputs.map((output) => `- ${output}`).join("\n")}

Return exactly one allowed output in assistant content.`,
    },
  ]
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

async function invokeRoleInputWithMetrics(
  config: ResolvedRoleSettings,
  role: ModelRole,
  step: RoleTextStep,
  attempt: number,
  input: ChatInput,
  onDelta?: (text: string) => Promise<void> | void
): Promise<RoleTextResult> {
  const startedAt = performance.now()

  const model = createChatModel(config)

  let text = ""
  let firstChunkAt: number | undefined
  let usage: TokenUsage | undefined
  let reasoningContent = ""
  let finishReason: string | undefined

  for await (const chunk of await model.stream(input)) {
    firstChunkAt ??= performance.now()
    const delta = contentToText(chunk.content)
    text += delta
    if (delta) {
      await onDelta?.(delta)
    }
    usage = readUsage(chunk.usage_metadata) ?? usage
    reasoningContent += readReasoningContent(chunk)
    finishReason = readFinishReason(chunk) ?? finishReason
  }

  const completedAt = performance.now()
  const tokenUsage = usage ?? zeroUsage()
  const trimmedReasoningContent = reasoningContent.trim()
  return {
    text: text.trim(),
    metrics: {
      role,
      step,
      attempt,
      ttftMs: Math.max(0, Math.round(firstChunkAt ? firstChunkAt - startedAt : completedAt - startedAt)),
      durationMs: Math.max(0, Math.round(completedAt - startedAt)),
      inputTokens: tokenUsage.inputTokens,
      reasoningTokens: tokenUsage.reasoningTokens,
      outputTokens: tokenUsage.outputTokens,
      totalTokens: tokenUsage.totalTokens,
      tokenSource: usage ? "provider" : "unavailable",
    },
    diagnostics: {
      reasoningContentObserved: Boolean(trimmedReasoningContent),
      reasoningContent: trimmedReasoningContent,
      finishReason,
    },
  }
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

function readReasoningContent(chunk: unknown): string {
  const candidates = [
    getPath(chunk, ["reasoning_content"]),
    getPath(chunk, ["additional_kwargs", "reasoning_content"]),
    getPath(chunk, ["response_metadata", "reasoning_content"]),
    getPath(chunk, ["kwargs", "additional_kwargs", "reasoning_content"]),
    readReasoningContentBlock(getPath(chunk, ["content"])),
  ]
  return candidates.filter((value): value is string => typeof value === "string" && value.length > 0).join("")
}

function readReasoningContentBlock(content: unknown): string | undefined {
  if (!Array.isArray(content)) {
    return undefined
  }
  return content
    .map((part) => {
      if (typeof part !== "object" || part === null) {
        return ""
      }
      const record = part as Record<string, unknown>
      if (record.type === "reasoning_content") {
        return typeof record.reasoningText === "string"
          ? record.reasoningText
          : typeof record.text === "string"
            ? record.text
            : ""
      }
      if (record.type === "reasoning" && typeof record.text === "string") {
        return record.text
      }
      return ""
    })
    .join("")
}

function readFinishReason(chunk: unknown): string | undefined {
  const candidates = [
    getPath(chunk, ["finish_reason"]),
    getPath(chunk, ["response_metadata", "finish_reason"]),
    getPath(chunk, ["response_metadata", "finishReason"]),
    getPath(chunk, ["generation_info", "finish_reason"]),
  ]
  return candidates.find((value): value is string => typeof value === "string")
}

function getPath(value: unknown, path: string[]): unknown {
  let current = value
  for (const key of path) {
    if (typeof current !== "object" || current === null || !(key in current)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }
  return current
}
