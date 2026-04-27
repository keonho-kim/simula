import { END, START, StateGraph } from "@langchain/langgraph"
import type { RunEvent } from "@simula/shared"
import { WorkflowAnnotation } from "../../state"
import { createRoleStepNode, type RoleGraphOptions } from "../shared"
import { generatorNode } from "./nodes"
import { generatorPrompts } from "./prompts"

export function createGeneratorGraph(emit: (event: RunEvent) => Promise<void>) {
  const options: RoleGraphOptions = {
    role: "generator",
    emit,
    prompts: generatorPrompts,
  }

  return new StateGraph(WorkflowAnnotation)
    .addNode("generator.thought", createRoleStepNode(options, "thought"))
    .addNode("generator.target", createRoleStepNode(options, "target"))
    .addNode("generator.action", createRoleStepNode(options, "action"))
    .addNode("generator.intent", createRoleStepNode(options, "intent"))
    .addNode("generator.apply", generatorNode)
    .addEdge(START, "generator.thought")
    .addEdge("generator.thought", "generator.target")
    .addEdge("generator.target", "generator.action")
    .addEdge("generator.action", "generator.intent")
    .addEdge("generator.intent", "generator.apply")
    .addEdge("generator.apply", END)
    .compile()
}
