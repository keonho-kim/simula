import { END, START, StateGraph } from "@langchain/langgraph"
import { actorCardPrompts } from "@/backend/core/simulation/roles/generator/cards/prompts"
import { createActorCardStepNode } from "@/backend/core/simulation/roles/generator/cards/node"
import { ActorCardAnnotation, completeActorCard, initialActorCardState, type ActorCardGraphState } from "@/backend/core/simulation/roles/generator/cards/state"
import type { ActorCard } from "@/backend/core/simulation/roles/generator/state"

export function createActorCardGraph() {
  return new StateGraph(ActorCardAnnotation)
    .addNode("actor-card.role", createActorCardStepNode("role", actorCardPrompts.role))
    .addNode(
      "actor-card.backgroundHistory",
      createActorCardStepNode("backgroundHistory", actorCardPrompts.backgroundHistory)
    )
    .addNode("actor-card.personality", createActorCardStepNode("personality", actorCardPrompts.personality))
    .addNode("actor-card.preference", createActorCardStepNode("preference", actorCardPrompts.preference))
    .addEdge(START, "actor-card.role")
    .addEdge("actor-card.role", "actor-card.backgroundHistory")
    .addEdge("actor-card.backgroundHistory", "actor-card.personality")
    .addEdge("actor-card.personality", "actor-card.preference")
    .addEdge("actor-card.preference", END)
    .compile()
}

export async function runActorCardGraph(
  input: Omit<ActorCardGraphState, "card" | "retryCounts">
): Promise<ActorCard> {
  const result = await createActorCardGraph().invoke(initialActorCardState(input))
  return completeActorCard(result)
}
