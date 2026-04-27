import { END, START, StateGraph } from "@langchain/langgraph"
import type { RunEvent } from "@simula/shared"
import { WorkflowAnnotation } from "../../state"
import { createRoleStepNode, type RoleGraphOptions } from "../shared"
import { coordinatorNode } from "./nodes"
import { coordinatorPrompts } from "./prompts"

export function createCoordinatorGraph(emit: (event: RunEvent) => Promise<void>) {
  const options: RoleGraphOptions = {
    role: "coordinator",
    emit,
    prompts: coordinatorPrompts,
  }

  return new StateGraph(WorkflowAnnotation)
    .addNode("coordinator.thought", createRoleStepNode(options, "thought"))
    .addNode("coordinator.target", createRoleStepNode(options, "target"))
    .addNode("coordinator.action", createRoleStepNode(options, "action"))
    .addNode("coordinator.intent", createRoleStepNode(options, "intent"))
    .addNode("coordinator.apply", (state) => coordinatorNode(state, emit))
    .addEdge(START, "coordinator.thought")
    .addEdge("coordinator.thought", "coordinator.target")
    .addEdge("coordinator.target", "coordinator.action")
    .addEdge("coordinator.action", "coordinator.intent")
    .addEdge("coordinator.intent", "coordinator.apply")
    .addEdge("coordinator.apply", END)
    .compile()
}
