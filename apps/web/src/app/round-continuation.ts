import type { RunEvent } from "@simula/shared"

export type RoundContinuationMode = "auto" | "prompt"

export interface RoundContinuationDecision {
  roundIndex: number
  mode: RoundContinuationMode
}

export function nextRoundContinuation(
  events: RunEvent[],
  handledRounds: Set<number>,
  autoContinue: boolean
): RoundContinuationDecision | undefined {
  const runStartedIndex = lastIndexOf(events, (event) => event.type === "run.started")
  const scopedEvents = runStartedIndex < 0 ? events : events.slice(runStartedIndex)
  if (scopedEvents.some((event) => event.type === "run.completed" || event.type === "run.failed" || event.type === "run.canceled")) {
    return undefined
  }
  const round = scopedEvents.findLast((event) => event.type === "round.completed")
  if (!round || handledRounds.has(round.roundIndex)) {
    return undefined
  }
  return {
    roundIndex: round.roundIndex,
    mode: autoContinue ? "auto" : "prompt",
  }
}

function lastIndexOf<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index] as T)) {
      return index
    }
  }
  return -1
}
