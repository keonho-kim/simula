import type { RunEvent } from "@simula/shared"
import { reasoningOnlyWarning, type RoleTextResult } from "../llm"

export async function emitNodeStarted(
  runId: string,
  nodeId: string,
  label: string,
  emit: (event: RunEvent) => Promise<void>
): Promise<void> {
  await emit({ type: "node.started", runId, timestamp: timestamp(), nodeId, label })
}

export async function emitNodeCompleted(
  runId: string,
  nodeId: string,
  label: string,
  emit: (event: RunEvent) => Promise<void>
): Promise<void> {
  await emit({ type: "node.completed", runId, timestamp: timestamp(), nodeId, label })
}

export function timestamp(): string {
  return new Date().toISOString()
}

export async function emitModelTelemetry(
  runId: string,
  result: RoleTextResult,
  emit: (event: RunEvent) => Promise<void>,
  actor?: { actorId: string; actorName: string }
): Promise<void> {
  await emit({
    type: "model.metrics",
    runId,
    timestamp: timestamp(),
    metrics: result.metrics,
  })
  if (result.diagnostics.reasoningContent || result.metrics.reasoningTokens > 0) {
    await emit({
      type: "model.reasoning",
      runId,
      timestamp: timestamp(),
      role: result.metrics.role,
      step: result.metrics.step,
      attempt: result.metrics.attempt,
      content: result.diagnostics.reasoningContent || "Reasoning content was not provided by the provider.",
      reasoningTokens: result.metrics.reasoningTokens,
      actorId: actor?.actorId,
      actorName: actor?.actorName,
    })
  }
  const message = reasoningOnlyWarning(result)
  if (message) {
    await emit({
      type: "log",
      runId,
      timestamp: timestamp(),
      level: "warn",
      message,
    })
  }
}
