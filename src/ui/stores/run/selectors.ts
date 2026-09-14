import type { RunEvent } from "@/shared"
import { nextRoundContinuation } from "@/ui/models/simulation/round-continuation"

interface RunEventState { liveEvents: RunEvent[]; selectedRunId?: string }
const NO_HANDLED_ROUNDS = new Set<number>()

export function selectTerminalEvent(state: RunEventState) {
  return state.liveEvents.findLast(event => event.runId === state.selectedRunId &&
    (event.type === "run.completed" || event.type === "run.failed" || event.type === "run.canceled"))
}

export function selectCompletedRound(state: RunEventState): number | undefined {
  return nextRoundContinuation(state.liveEvents.filter(event => event.runId === state.selectedRunId), NO_HANDLED_ROUNDS)
}
