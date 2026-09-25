/**
 * Purpose: Construct and execute independent actor-card graphs with compact output channels.
 * Pattern: State graph with external per-card dependencies.
 * Usage: Called by Generator for each roster entry.
 * Related: src/backend/core/simulation/roles/generator/cards/context.ts, src/backend/core/simulation/roles/generator/cards/state.ts
 */
import { END, START, StateGraph } from "@langchain/langgraph"
import { actorCardPrompts } from "@/backend/core/simulation/roles/generator/cards/prompts"
import { createActorCardStepNode } from "@/backend/core/simulation/roles/generator/cards/node"
import { ActorCardAnnotation, completeActorCard, initialActorCardState } from "@/backend/core/simulation/roles/generator/cards/state"
import type { ActorCard } from "@/backend/core/simulation/roles/generator/state"

import type { ActorCardExecution } from "./context"

export function createActorCardGraph(input: ActorCardExecution) {
  const execution = { ...input, context: { ...input.context, fullRoster: input.context.fullRoster.map(entry => ({ ...entry })) } }
  return new StateGraph(ActorCardAnnotation)
    .addNode("actor-card.role", createActorCardStepNode("role", actorCardPrompts.role, execution))
    .addNode(
      "actor-card.backgroundHistory",
      createActorCardStepNode("backgroundHistory", actorCardPrompts.backgroundHistory, execution)
    )
    .addNode("actor-card.personality", createActorCardStepNode("personality", actorCardPrompts.personality, execution))
    .addNode("actor-card.preference", createActorCardStepNode("preference", actorCardPrompts.preference, execution))
    .addEdge(START, "actor-card.role")
    .addEdge("actor-card.role", "actor-card.backgroundHistory")
    .addEdge("actor-card.backgroundHistory", "actor-card.personality")
    .addEdge("actor-card.personality", "actor-card.preference")
    .addEdge("actor-card.preference", END)
    .compile()
}

export async function runActorCardGraph(
  execution: ActorCardExecution
): Promise<ActorCard> {
  const assignedName = execution.context.assignedName
  const result = await createActorCardGraph(execution).invoke(initialActorCardState())
  return completeActorCard(result, assignedName)
}
