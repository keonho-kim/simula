import type { ActionVisibility, ActorAction, ActorState } from "@simula/shared"
import { emptyActorContext } from "../../context"

const VISIBILITIES: ActionVisibility[] = ["public", "semi-public", "private", "solitary"]

export interface ActorCard {
  role: string
  name: string
  backgroundHistory: string
  personality: string
  preference: string
}

export function buildActor(index: number, card: ActorCard, plannerDigest: string, actionsPerType: number): ActorState {
  const preference = card.preference || `Shape the outcome of ${firstSentence(plannerDigest).toLowerCase()}.`
  const personality = card.personality || "Pragmatic under pressure."
  return {
    id: `actor-${index}`,
    name: card.name || `Actor ${index}`,
    role: card.role || (index === 1 ? "Primary decision maker" : `Stakeholder ${index}`),
    backgroundHistory: card.backgroundHistory || firstSentence(plannerDigest),
    personality,
    preference,
    privateGoal: preference,
    intent: `${personality} Preference: ${preference}`,
    actions: buildActorActions(index, card, actionsPerType),
    context: emptyActorContext(),
    contextSummary: "",
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
  card: ActorCard,
  actionsPerType: number
): ActorAction[] {
  return VISIBILITIES.flatMap((visibility) =>
    Array.from({ length: actionsPerType }, (_, index) => buildAction(actorIndex, visibility, index + 1, card))
  )
}

function buildAction(
  actorIndex: number,
  visibility: ActionVisibility,
  actionIndex: number,
  card: ActorCard
): ActorAction {
  return {
    id: `actor-${actorIndex}-${visibility}-${actionIndex}`,
    visibility,
    label: `${visibilityLabel(visibility)} ${actionIndex} about ${card.preference}`,
    intentHint: card.preference,
    expectedOutcome: `${card.name} creates a ${visibility} consequence shaped by ${card.personality}.`,
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

function firstSentence(value: string): string {
  return value.split(/[.!?]/).find((item) => item.trim())?.trim() ?? "the scenario pressure"
}
