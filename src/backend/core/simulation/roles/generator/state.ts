import type { ActionCatalog, ActorState } from "@/shared"
import { emptyActorContext } from "@/backend/core/simulation/actors/memory"

export interface ActorCard {
  role: string
  name: string
  backgroundHistory: string
  personality: string
  preference: string
}

export function buildActor(index: number, card: ActorCard, plannerDigest: string, actionCatalog: ActionCatalog): ActorState {
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
    actions: Object.values(actionCatalog),
    context: emptyActorContext(),
    contextSummary: "",
    memory: [],
    relationships: {},
  }
}

function firstSentence(value: string): string {
  return value.split(/[.!?]/).find((item) => item.trim())?.trim() ?? "the scenario pressure"
}
