import type {
  ActorCardStep,
  ActorTraceStep,
  CoordinatorTraceStep,
  GeneratorRosterStep,
  LLMSettings,
  ModelMetrics,
  ModelRole,
  PlannerTraceStep,
} from "@simula/shared"
import { resolveRoleSettings } from "../settings"
import { contentToText } from "./content"
import { createChatModel } from "./model-factory"
import { readUsage, zeroUsage } from "./usage"
import type { TokenUsage } from "./types"

export interface RoleTextResult {
  text: string
  metrics: ModelMetrics
}

export async function invokeRoleText(
  settings: LLMSettings,
  role: ModelRole,
  prompt: string
): Promise<string> {
  return (await invokeRoleTextWithMetrics(settings, role, "draft", 1, prompt)).text
}

export async function invokeRoleTextWithMetrics(
  settings: LLMSettings,
  role: ModelRole,
  step: ActorTraceStep | PlannerTraceStep | CoordinatorTraceStep | GeneratorRosterStep | ActorCardStep | "draft",
  attempt: number,
  prompt: string
): Promise<RoleTextResult> {
  const config = resolveRoleSettings(settings, role)
  const startedAt = performance.now()

  const model = createChatModel(config)

  let text = ""
  let firstChunkAt: number | undefined
  let usage: TokenUsage | undefined

  for await (const chunk of await model.stream(prompt)) {
    firstChunkAt ??= performance.now()
    text += contentToText(chunk.content)
    usage = readUsage(chunk.usage_metadata) ?? usage
  }

  const completedAt = performance.now()
  const tokenUsage = usage ?? zeroUsage()
  return {
    text: text.trim(),
    metrics: {
      role,
      step,
      attempt,
      ttftMs: Math.max(0, Math.round(firstChunkAt ? firstChunkAt - startedAt : completedAt - startedAt)),
      durationMs: Math.max(0, Math.round(completedAt - startedAt)),
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      totalTokens: tokenUsage.totalTokens,
      tokenSource: usage ? "provider" : "unavailable",
    },
  }
}

