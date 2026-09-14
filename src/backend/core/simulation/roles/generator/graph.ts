import { END, START, StateGraph } from "@langchain/langgraph"
import type { RunEvent } from "@/shared"
import { WorkflowAnnotation } from "@/backend/core/simulation/workflow/state"
import { createGeneratorCardsNode, createGeneratorRosterNode } from "@/backend/core/simulation/roles/generator/nodes"

export function createGeneratorGraph(emit: (event: RunEvent) => Promise<void>) {
  return new StateGraph(WorkflowAnnotation)
    .addNode("generator.roster", createGeneratorRosterNode(emit))
    .addNode("generator.cards", createGeneratorCardsNode(emit))
    .addEdge(START, "generator.roster")
    .addEdge("generator.roster", "generator.cards")
    .addEdge("generator.cards", END)
    .compile()
}
