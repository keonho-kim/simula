/**
 * Purpose: Own partial actor-card output and reject incomplete card assembly.
 * Pattern: Graph state with deterministic completion.
 * Usage: Used by the per-actor card graph and its field nodes.
 * Related: src/backend/core/simulation/roles/generator/cards/context.ts, src/backend/core/simulation/roles/generator/cards/graph.ts
 */
import { Annotation } from "@langchain/langgraph"
import type { ActorCardStep } from "@/shared"
import type { ActorCard } from "@/backend/core/simulation/roles/generator/state"
import type { ActorCardContext } from "./context"

export interface ActorCardGraphState {
  card: Partial<ActorCard>
  retryCounts: Record<ActorCardStep, number>
}
export type ActorCardStepInput = ActorCardContext & ActorCardGraphState

export function initialActorCardState(): ActorCardGraphState {
  return { card: {}, retryCounts: { role: 0, backgroundHistory: 0, personality: 0, preference: 0 } }
}

export function completeActorCard(state: ActorCardGraphState, assignedName: string): ActorCard {
  const { role, backgroundHistory, personality, preference } = state.card
  if (!role?.trim() || !backgroundHistory?.trim() || !personality?.trim() || !preference?.trim()) {
    throw new Error("Actor card is incomplete; all generated fields are required.")
  }
  return { name: assignedName, role, backgroundHistory, personality, preference }
}

export const ActorCardAnnotation = Annotation.Root({
  card: Annotation<Partial<ActorCard>>(),
  retryCounts: Annotation<Record<ActorCardStep, number>>(),
})
