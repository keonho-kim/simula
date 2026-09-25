/**
 * Purpose: Select stable run control state without scanning a lossy display-event window.
 * Pattern: Store selectors.
 * Usage: Used by the browser round-progression hook.
 * Related: src/ui/models/simulation/round-continuation.ts, src/ui/stores/run-store.ts
 */
import type { RoundProgress } from "@/ui/models/simulation/round-continuation"

interface RunProgressState { roundProgress: RoundProgress; selectedRunId?: string }

export function selectTerminalEvent(state: RunProgressState) {
  return state.roundProgress.runId === state.selectedRunId ? state.roundProgress.terminal : undefined
}

export function selectCompletedRound(state: RunProgressState): number | undefined {
  const progress = state.roundProgress
  if (progress.runId !== state.selectedRunId || progress.terminal || progress.round?.awaitsContinuation === false) return undefined
  return progress.round?.roundIndex
}
