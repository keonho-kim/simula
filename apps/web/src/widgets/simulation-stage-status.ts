import type { GraphTimelineFrame, RunEvent, SimulationState } from "@simula/shared"

export interface SimulationStageStatus {
  currentRound: number
  maxRound?: number
  respondedActors: number
  totalActors: number
  waitingActors: number
}

export function buildSimulationStageStatus(
  events: RunEvent[],
  runState: SimulationState | undefined,
  timeline: GraphTimelineFrame[]
): SimulationStageStatus | undefined {
  const scopedEvents = eventsSinceLatestRunStart(events)
  const actorIds = actorIdsForStatus(scopedEvents, runState, timeline)
  const totalActors = actorIds.size
  const latestRound = latestRoundIndex(scopedEvents, runState)
  if (!totalActors || latestRound === undefined) {
    return undefined
  }

  const roundCompleted = scopedEvents.some((event) => event.type === "round.completed" && event.roundIndex === latestRound)
  const respondedActors = new Set(
    scopedEvents
      .filter((event): event is Extract<RunEvent, { type: "interaction.recorded" }> =>
        event.type === "interaction.recorded" && event.interaction.roundIndex === latestRound
      )
      .map((event) => event.interaction.sourceActorId)
      .filter((actorId) => actorIds.has(actorId))
  )

  return {
    currentRound: latestRound,
    maxRound: runState?.scenario.controls.maxRound,
    respondedActors: roundCompleted ? totalActors : respondedActors.size,
    totalActors,
    waitingActors: roundCompleted ? 0 : Math.max(0, totalActors - respondedActors.size),
  }
}

function eventsSinceLatestRunStart(events: RunEvent[]): RunEvent[] {
  const runStartedIndex = lastIndexOf(events, (event) => event.type === "run.started")
  return runStartedIndex < 0 ? events : events.slice(runStartedIndex)
}

function actorIdsForStatus(
  events: RunEvent[],
  runState: SimulationState | undefined,
  timeline: GraphTimelineFrame[]
): Set<string> {
  const actorsReady = [...events].reverse().find(
    (event): event is Extract<RunEvent, { type: "actors.ready" }> => event.type === "actors.ready"
  )
  if (actorsReady?.actors.length) {
    return new Set(actorsReady.actors.map((actor) => actor.id))
  }
  if (runState?.actors.length) {
    return new Set(runState.actors.map((actor) => actor.id))
  }
  return new Set(timeline.at(-1)?.nodes.map((node) => node.id) ?? [])
}

function latestRoundIndex(events: RunEvent[], runState: SimulationState | undefined): number | undefined {
  const roundSignals = events.flatMap((event) => {
    if (event.type === "event.injected") return [event.event.roundIndex]
    if (event.type === "interaction.recorded") return [event.interaction.roundIndex]
    if (event.type === "round.completed") return [event.roundIndex]
    return []
  })
  const latestRound = Math.max(0, ...roundSignals)
  if (latestRound > 0) {
    return latestRound
  }
  if (events.some((event) => event.type === "actors.ready") || (runState?.actors.length ?? 0) > 0) {
    return 1
  }
  return undefined
}

function lastIndexOf<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index] as T)) {
      return index
    }
  }
  return -1
}
