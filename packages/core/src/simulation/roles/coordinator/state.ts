import type {
  ActorDecision,
  ActorState,
  CoordinatorTrace,
  CoordinatorTraceStep,
  Interaction,
  PlannedEvent,
  RoundDigest,
  SimulationState,
} from "@simula/shared"

export const COORDINATOR_STEPS: CoordinatorTraceStep[] = [
  "runtimeFrame",
  "actorRouting",
  "interactionPolicy",
  "outcomeDirection",
  "eventInjection",
  "progressDecision",
  "extensionDecision",
]

export function getCoordinatorTrace(state: SimulationState): CoordinatorTrace {
  const trace = state.roleTraces.find((trace) => trace.role === "coordinator")
  return trace?.role === "coordinator" ? trace : emptyCoordinatorTrace()
}

export function coordinatorTracePartial(trace: CoordinatorTrace): Partial<Record<CoordinatorTraceStep, string>> {
  return Object.fromEntries(COORDINATOR_STEPS.map((step) => [step, trace[step]]))
}

export function emptyCoordinatorTrace(): CoordinatorTrace {
  return {
    role: "coordinator",
    runtimeFrame: "",
    actorRouting: "",
    interactionPolicy: "",
    outcomeDirection: "",
    eventInjection: "",
    progressDecision: "",
    extensionDecision: "",
    retryCounts: {
      runtimeFrame: 0,
      actorRouting: 0,
      interactionPolicy: 0,
      outcomeDirection: 0,
      eventInjection: 0,
      progressDecision: 0,
      extensionDecision: 0,
    },
  }
}

export function buildPreRoundDigest(roundIndex: number, injectedEvent?: PlannedEvent): RoundDigest {
  const elapsedTime = roundIndex === 1 ? "Opening moment" : `Round ${roundIndex}`
  const content = injectedEvent
    ? `Injected event: ${injectedEvent.title}. ${injectedEvent.summary}`
    : "No new major event was injected; actors respond to accumulated context and unresolved pressure."
  return {
    roundIndex,
    preRound: {
      elapsedTime,
      content,
    },
    afterRound: {
      content: "",
    },
    injectedEventId: injectedEvent?.id,
  }
}

export function applyActorDecision(actors: ActorState[], decision: ActorDecision): ActorState[] {
  return actors.map((actor) => {
    if (actor.id !== decision.actorId) {
      return actor
    }

    const relationships = Object.fromEntries(
      decision.targetActorIds
        .map((targetId) => actors.find((candidate) => candidate.id === targetId))
        .filter((target): target is ActorState => Boolean(target))
        .map((target) => [target.name, `engaged through a ${decision.visibility} interaction`])
    )

    return {
      ...actor,
      intent: decision.intent,
      relationships: {
        ...actor.relationships,
        ...relationships,
      },
    }
  })
}

export function buildInteraction(
  roundIndex: number,
  event: PlannedEvent,
  actor: ActorState,
  actors: ActorState[],
  decision: ActorDecision
): Interaction {
  return {
    id: `round-${roundIndex}-${actor.id}`,
    roundIndex,
    sourceActorId: actor.id,
    targetActorIds: decision.targetActorIds,
    actionType: decision.actionId ?? decision.decisionType,
    content: interactionContent(actor, actors, event, decision),
    eventId: event.id,
    visibility: decision.visibility,
    decisionType: decision.decisionType,
    intent: decision.intent,
    expectation: decision.expectation,
  }
}

function interactionContent(
  actor: ActorState,
  actors: ActorState[],
  event: PlannedEvent,
  decision: ActorDecision
): string {
  if (decision.message) {
    return `${actor.name}: ${decision.message}`
  }
  if (decision.decisionType === "no_action") {
    return `${actor.name} held back during "${event.title}".`
  }
  const targetNames = decision.targetActorIds
    .map((targetId) => actors.find((candidate) => candidate.id === targetId)?.name)
    .filter(Boolean)
  const targetText = targetNames.length > 0 ? ` with ${targetNames.join(", ")}` : ""
  return `${actor.name} advanced "${event.title}"${targetText} through a ${decision.visibility} action.`
}
