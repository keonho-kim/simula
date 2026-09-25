/**
 * Purpose: Sum model work by recorded scope without inventing missing token usage.
 * Pattern: Pure deterministic projection.
 * Usage: Called when assembling an analytical report's resource accounting.
 * Related: src/shared/analytical-report.ts, src/backend/runtime/analysis/accounting.ts
 */
import type { ResourceUsage, UsageMeasure } from "@/shared/analytical-report"

const missing: ResourceUsage = { calls: null, observedCalls: 0, durationMs: null, queueWaitMs: null,
  inputTokens: null, reasoningTokens: null, outputTokens: null, totalTokens: null, unavailableTokenCalls: 0 }

export function summarizeUsage(calls: readonly UsageMeasure[] | undefined, failedAttempts: number | null = 0): ResourceUsage {
  if (!Number.isSafeInteger(failedAttempts) && failedAttempts !== null || failedAttempts !== null && failedAttempts < 0) {
    throw new Error("Failed model attempt count must be nonnegative or unknown.")
  }
  if (!calls) return { ...missing, observedCalls: failedAttempts ?? 0, unavailableTokenCalls: failedAttempts ?? 0 }
  const failed = failedAttempts ?? 0
  const complete = failedAttempts !== null && failed === 0
  const provider = complete && calls.every(call => call.tokenSource === "provider")
  const queue = complete && calls.every(call => call.queueWaitMs !== undefined)
  return { calls: failedAttempts === null ? null : calls.length + failed, observedCalls: calls.length + failed,
    durationMs: complete ? calls.reduce((total, call) => total + call.durationMs, 0) : null,
    queueWaitMs: queue ? calls.reduce((total, call) => total + (call.queueWaitMs ?? 0), 0) : null,
    inputTokens: provider ? calls.reduce((total, call) => total + call.inputTokens, 0) : null,
    reasoningTokens: provider ? calls.reduce((total, call) => total + call.reasoningTokens, 0) : null,
    outputTokens: provider ? calls.reduce((total, call) => total + call.outputTokens, 0) : null,
    totalTokens: provider ? calls.reduce((total, call) => total + call.totalTokens, 0) : null,
    unavailableTokenCalls: calls.filter(call => call.tokenSource === "unavailable").length + failed }
}

export function combineUsage(scopes: readonly (ResourceUsage | null)[]): ResourceUsage {
  const relevant = scopes.filter((scope): scope is ResourceUsage => scope !== null)
  const sum = (key: "calls" | "durationMs" | "queueWaitMs" | "inputTokens" | "reasoningTokens" | "outputTokens" | "totalTokens") =>
    relevant.some(scope => scope[key] === null) ? null : relevant.reduce((total, scope) => total + (scope[key] ?? 0), 0)
  return { calls: sum("calls"), observedCalls: relevant.reduce((total, scope) => total + scope.observedCalls, 0),
    durationMs: sum("durationMs"), queueWaitMs: sum("queueWaitMs"), inputTokens: sum("inputTokens"),
    reasoningTokens: sum("reasoningTokens"), outputTokens: sum("outputTokens"), totalTokens: sum("totalTokens"),
    unavailableTokenCalls: relevant.reduce((total, scope) => total + scope.unavailableTokenCalls, 0) }
}
