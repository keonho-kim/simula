import { END, START, StateGraph } from "@langchain/langgraph"
import type { RunEvent } from "@simula/shared"
import { WorkflowAnnotation } from "../../state"
import { createGeneratorCardsNode, createGeneratorRosterNode } from "./nodes"

export function createGeneratorGraph(emit: (event: RunEvent) => Promise<void>) {
  return new StateGraph(WorkflowAnnotation)
    .addNode("generator.roster", createGeneratorRosterNode(emit))
    .addNode("generator.cards", createGeneratorCardsNode(emit))
    .addEdge(START, "generator.roster")
    .addEdge("generator.roster", "generator.cards")
    .addEdge("generator.cards", END)
    .compile()
}
