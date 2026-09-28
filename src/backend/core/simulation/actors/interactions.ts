/**
 * Purpose: Apply actor decisions and construct accepted interaction records.
 * Pattern: Pure state transition.
 * Usage: Called by coordinator actor-round after a validated actor graph decision.
 * Related: src/backend/core/simulation/roles/coordinator/actor-round.ts, src/backend/core/simulation/events/injection.ts
 */
import type { ActorDecision, ActorState, Interaction, PlannedEvent, PromptLanguage } from "@/shared"
import { sanitizeActorVisibleText } from "@/backend/core/simulation/actors/visible-text"
import { projectEventForActor } from "@/backend/core/simulation/events/injection"

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
  decision: ActorDecision,
  language: PromptLanguage = "en"
): Interaction {
  return {
    id: `round-${roundIndex}-${actor.id}`,
    roundIndex,
    thought: sanitizeActorVisibleText(decision.thought, actors),
    sourceActorId: actor.id,
    targetActorIds: decision.targetActorIds,
    actionCode: decision.actionId,
    actionType: actionLabel(actor, decision.actionId) ?? decision.decisionType,
    content: sanitizeActorVisibleText(interactionContent(actor, actors, projectEventForActor(event, actor.id).event, decision, language), actors),
    eventId: event.id,
    visibility: decision.visibility,
    decisionType: decision.decisionType,
    intent: sanitizeActorVisibleText(decision.intent, actors),
    expectation: sanitizeActorVisibleText(decision.expectation, actors),
  }
}

function actionLabel(actor: ActorState, actionId: string | undefined): string | undefined {
  if (!actionId) {
    return undefined
  }
  return actor.actions.find((action) => action.id === actionId)?.label ?? actionId
}

function interactionContent(
  actor: ActorState,
  actors: ActorState[],
  event: PlannedEvent,
  decision: ActorDecision,
  language: PromptLanguage
): string {
  if (decision.visibility === "solitary" && decision.actionDescription) {
    return decision.actionDescription
  }
  if (decision.visibility !== "solitary" && decision.message) {
    return `${actor.name}: ${decision.message}`
  }
  if (decision.decisionType === "no_action") {
    return language === "ko" ? `${actor.name}: 「${event.title}」에서 행동을 보류한다.` : `${actor.name} held back during "${event.title}".`
  }
  const targetNames = decision.targetActorIds
    .map((targetId) => actors.find((candidate) => candidate.id === targetId)?.name)
    .filter(Boolean)
  const label = actionLabel(actor, decision.actionId)
  if (language === "ko") {
    const targetText = targetNames.length ? ` 대상: ${targetNames.join(", ")}.` : ""
    return `${actor.name}: 「${event.title}」에서 ${label ? `‘${label}’ 행동을 수행한다.` : "행동을 수행한다."}${targetText}`
  }
  const targetText = targetNames.length > 0 ? ` with ${targetNames.join(", ")}` : ""
  return `${actor.name} performed ${label ? `"${label}"` : "an action"}${targetText} during "${event.title}".`
}
