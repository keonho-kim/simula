import type { ActionVisibility, ActorAction, ActorState } from "@simula/shared"
import { emptyActorContext } from "../../context"

const VISIBILITIES: ActionVisibility[] = ["public", "semi-public", "private", "solitary"]

export function buildActor(
  index: number,
  backgroundStory: string,
  trace: { target: string; action: string; intent: string },
  actionsPerType: number
): ActorState {
  const sentence = backgroundStory.split(/[.!?]/).find((item) => item.trim())?.trim() ?? "the background story"
  return {
    id: `actor-${index}`,
    name: `Actor ${index}`,
    role: index === 1 ? "Primary decision maker" : `Stakeholder ${index}`,
    privateGoal: `Shape the outcome of ${sentence.toLowerCase()}.`,
    intent: index === 1 ? trace.intent : `Respond to ${trace.target.toLowerCase()}.`,
    actions: buildActorActions(index, trace, actionsPerType),
    context: emptyActorContext(),
    memory: [],
    relationships: {},
  }
}

export function buildActionCatalog(actors: ActorState): string[]
export function buildActionCatalog(actors: ActorState[]): string[]
export function buildActionCatalog(actors: ActorState | ActorState[]): string[] {
  const actorList = Array.isArray(actors) ? actors : [actors]
  return actorList.flatMap((actor) => actor.actions.map((action) => `${actor.name}: ${action.label}`))
}

function buildActorActions(
  actorIndex: number,
  trace: { target: string; action: string; intent: string },
  actionsPerType: number
): ActorAction[] {
  return VISIBILITIES.flatMap((visibility) =>
    Array.from({ length: actionsPerType }, (_, index) => buildAction(actorIndex, visibility, index + 1, trace))
  )
}

function buildAction(
  actorIndex: number,
  visibility: ActionVisibility,
  actionIndex: number,
  trace: { target: string; action: string; intent: string }
): ActorAction {
  return {
    id: `actor-${actorIndex}-${visibility}-${actionIndex}`,
    visibility,
    label: `${visibilityLabel(visibility)} ${actionIndex} about ${trace.target}`,
    intentHint: trace.intent,
    expectedOutcome: `${trace.action} creates a ${visibility} consequence.`,
  }
}

function visibilityLabel(visibility: ActionVisibility): string {
  if (visibility === "public") {
    return "Public move"
  }
  if (visibility === "semi-public") {
    return "Semi-public exchange"
  }
  if (visibility === "private") {
    return "Private encounter"
  }
  return "Solitary reflection"
}
