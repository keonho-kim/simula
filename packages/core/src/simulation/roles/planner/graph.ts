import { END, START, StateGraph } from "@langchain/langgraph"
import type { RunEvent } from "@simula/shared"
import { WorkflowAnnotation } from "../../state"
import { createRoleStepNode, type RoleGraphOptions } from "../shared"
import { plannerNode } from "./nodes"
import { plannerPrompts } from "./prompts"

export function createPlannerGraph(emit: (event: RunEvent) => Promise<void>) {
  const options: RoleGraphOptions = {
    role: "planner",
    emit,
    prompts: plannerPrompts,
  }

  return new StateGraph(WorkflowAnnotation)
    .addNode("planner.thought", createRoleStepNode(options, "thought"))
    .addNode("planner.target", createRoleStepNode(options, "target"))
    .addNode("planner.action", createRoleStepNode(options, "action"))
    .addNode("planner.intent", createRoleStepNode(options, "intent"))
    .addNode("planner.apply", plannerNode)
    .addEdge(START, "planner.thought")
    .addEdge("planner.thought", "planner.target")
    .addEdge("planner.target", "planner.action")
    .addEdge("planner.action", "planner.intent")
    .addEdge("planner.intent", "planner.apply")
    .addEdge("planner.apply", END)
    .compile()
}
