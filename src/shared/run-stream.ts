/**
 * Purpose: Define run stream kinds, bounded envelopes, and run-scoped byte cursors.
 * Pattern: Shared transport contract.
 * Usage: Used by the event-log reader and browser run subscription.
 * Related: src/shared/run.ts, src/backend/storage/runs/event-log.ts
 */
import type { RunEvent } from "./run"

export const MAX_RUN_EVENT_BYTES = 8 * 1024 * 1024
export const RUN_STREAM_END = "stream.end"
export const RUN_STREAM_ERROR = "stream.error"
export const RUN_EVENT_TYPES = [
  "run.started", "board.updated", "node.started", "node.completed", "node.failed", "model.message",
  "model.reasoning", "model.metrics", "model.attempt.failed", "actors.ready", "event.injected",
  "interaction.recorded", "actor.message", "round.completed", "graph.delta", "log", "report.delta",
  "report.commentary", "run.completed", "run.failed", "run.canceled",
] as const satisfies readonly RunEvent["type"][]
const eventTypes: ReadonlySet<string> = new Set(RUN_EVENT_TYPES)

export class RunStreamCursorError extends Error {}

export function parseRunCursor(cursor: string | undefined, runId: string): number {
  if (!cursor) return 0
  const prefix = `${runId}:`
  const offset = cursor.slice(prefix.length)
  if (!cursor.startsWith(prefix) || !/^(0|[1-9]\d*)$/.test(offset) || !Number.isSafeInteger(Number(offset))) {
    throw new RunStreamCursorError("Invalid run event cursor.")
  }
  return Number(offset)
}

export function parseRunEventEnvelope(value: unknown, runId: string): RunEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || !("type" in value) || typeof value.type !== "string" || !eventTypes.has(value.type)
    || !("runId" in value) || typeof value.runId !== "string"
    || !("timestamp" in value) || typeof value.timestamp !== "string") throw new Error("Invalid run event envelope.")
  if (value.runId !== runId) throw new Error("Run event scope does not match the requested run.")
  // This boundary checks transport identity, not the legacy event-specific domain payloads.
  return value as RunEvent
}
