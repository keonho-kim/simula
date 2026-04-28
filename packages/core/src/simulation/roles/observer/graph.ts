import { END, START, StateGraph } from "@langchain/langgraph"
import type { RunEvent } from "@simula/shared"
import { WorkflowAnnotation } from "../../state"
import { createRoleStepNode, type RoleGraphOptions } from "../shared"
import { observerNode } from "./nodes"
import { observerPrompts } from "./prompts"

export function createObserverGraph(emit: (event: RunEvent) => Promise<void>) {
  const options: RoleGraphOptions = {
    role: "observer",
    emit,
    prompts: observerPrompts,
  }

  return new StateGraph(WorkflowAnnotation)
    .addNode("observer.thought", createRoleStepNode(options, "thought"))
    .addNode("observer.target", createRoleStepNode(options, "target"))
    .addNode("observer.action", createRoleStepNode(options, "action"))
    .addNode("observer.intent", createRoleStepNode(options, "intent"))
    .addNode("observer.apply", observerNode)
    .addEdge(START, "observer.thought")
    .addEdge("observer.thought", "observer.target")
    .addEdge("observer.target", "observer.action")
    .addEdge("observer.action", "observer.intent")
    .addEdge("observer.intent", "observer.apply")
    .addEdge("observer.apply", END)
    .compile()
}
