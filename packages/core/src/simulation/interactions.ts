import type { ActorDecision, ActorState, Interaction, PlannedEvent } from "@simula/shared"
import { sanitizeActorVisibleText } from "./visible-text"

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
    content: sanitizeActorVisibleText(interactionContent(actor, actors, event, decision), actors),
    eventId: event.id,
    visibility: decision.visibility,
    decisionType: decision.decisionType,
    intent: sanitizeActorVisibleText(decision.intent, actors),
    expectation: sanitizeActorVisibleText(decision.expectation, actors),
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
