/**
 * Purpose: Bind configured builder or observer settings to bounded text and choice calls.
 * Pattern: Provider invocation adapter.
 * Usage: Used by shared-scenario, world-preparation, and analytical report runtime owners.
 * Related: src/backend/core/generation/tasks.ts, src/backend/integrations/llm/transport-retry.ts
 */
import { createHash } from "node:crypto"
import type { LLMSettings } from "@/shared/settings"
import type { GenerationCall, GenerationDependencies } from "@/backend/core/generation/tasks"
import { resolveRoleSettings, validateRoleSettings } from "@/backend/core/settings"
import { invokeRoleTextWithMetrics, modelOutputTruncated } from "./invoke"
import { transportRetryDelayMs, waitForTransportRetry } from "./transport-retry"

const COMPACT_TASK_KINDS = new Set<GenerationCall["kind"]>([
  "evidence", "digest", "facet", "situation", "roster", "participant", "rules", "source-access", "check",
])
const LMSTUDIO_COMPACT_REASONING_VERSION = "lmstudio-compact-reasoning-none-v1"

export function createGenerationInvocation(settings: LLMSettings, signal: AbortSignal, role: "storyBuilder" | "observer" = "storyBuilder"): Pick<GenerationDependencies, "invoke" | "modelRevision" | "transportRetry"> {
  validateRoleSettings(settings, role)
  const configured = settings.roles[role]
  const automaticNoReasoning = role === "storyBuilder" && configured.provider === "lmstudio"
    && configured.reasoningEffort === undefined && configured.extraBody?.reasoning_effort === undefined
  const compactSettings: LLMSettings = automaticNoReasoning ? { ...settings, roles: { ...settings.roles,
    [role]: { ...configured, extraBody: { ...configured.extraBody, reasoning_effort: "none" } } } } : settings
  const revision = JSON.stringify(resolveRoleSettings(settings, role))
    + (automaticNoReasoning ? LMSTUDIO_COMPACT_REASONING_VERSION : "")
  const modelRevision = createHash("sha256").update(revision).digest("hex")
  return { modelRevision, transportRetry: { delayMs: transportRetryDelayMs, wait: waitForTransportRetry }, invoke: async call => {
    const effective = automaticNoReasoning && COMPACT_TASK_KINDS.has(call.kind) ? compactSettings : settings
    const result = await invokeRoleTextWithMetrics(effective, role, role === "observer" ? "reportCommentary" : "draft", call.attempt, call.prompt, call.onDelta,
      { maxOutputTokens: call.maxOutputTokens, maxResponseBytes: 32 * 1024, signal: AbortSignal.any([signal, call.signal]),
        onAdmission: call.onAdmission, taskId: call.id })
    return { text: result.text, metrics: result.metrics, truncated: modelOutputTruncated(result) }
  } }
}
