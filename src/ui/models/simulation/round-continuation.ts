/**
 * Purpose: Retain authoritative round and terminal facts independently of the bounded display log.
 * Pattern: Pure incremental reducer.
 * Usage: Applied by the run store to streamed events and persisted-history snapshots.
 * Related: src/ui/stores/run-store.ts, src/ui/stores/run/selectors.ts
 */
import type { RunEvent } from "@/shared"

type CompletedRound = Extract<RunEvent, { type: "round.completed" }>
type TerminalRun = Extract<RunEvent, { type: "run.completed" | "run.failed" | "run.canceled" }>

export interface RoundProgress {
  runId?: string
  round?: CompletedRound
  terminal?: TerminalRun
}

export function reduceRoundProgress(previous: RoundProgress, events: readonly RunEvent[], runId: string | undefined): RoundProgress {
  let progress = previous.runId === runId ? previous : { runId }
  if (!runId) return progress
  for (const event of events) {
    if (event.runId !== runId) continue
    if (event.type === "run.completed" || event.type === "run.failed" || event.type === "run.canceled") {
      const terminal = progress.terminal
      if (!terminal || event.timestamp > terminal.timestamp || (event.timestamp === terminal.timestamp && event.type !== terminal.type)) {
        progress = { ...progress, terminal: event }
      }
    } else if (event.type === "round.completed" && !progress.terminal) {
      if (!Number.isSafeInteger(event.roundIndex) || event.roundIndex < 1) continue
      const round = progress.round
      if (!round || event.roundIndex > round.roundIndex
        || (event.roundIndex === round.roundIndex && round.awaitsContinuation === undefined && event.awaitsContinuation !== undefined)) {
        progress = { ...progress, round: event }
      }
    }
    // A run ID has one execution history. Replaying run.started must never reset accepted progress.
  }
  return progress
}
