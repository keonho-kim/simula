/**
 * Purpose: Compose coordinator directives and rounds with caller-owned state persistence.
 * Pattern: Workflow graph.
 * Usage: Constructed by the top-level simulation graph.
 * Related: src/backend/core/simulation/roles/coordinator/nodes.ts, src/backend/core/simulation/workflow/graph.ts
 */
import { END, START, StateGraph } from "@langchain/langgraph"
import type { RunEvent, SimulationState } from "@/shared"
import { WorkflowAnnotation } from "@/backend/core/simulation/workflow/state"
import { coordinatorNode, createCoordinatorStepNode } from "@/backend/core/simulation/roles/coordinator/nodes"
import { coordinatorPrompts } from "@/backend/core/simulation/roles/coordinator/prompts"

export function createCoordinatorGraph(
  emit: (event: RunEvent) => Promise<void>,
  roundDelayMs = 0,
  waitForNextRound?: (roundIndex: number) => Promise<void>,
  isCanceled?: () => boolean,
  saveState?: (state: SimulationState) => Promise<void>
) {
  return new StateGraph(WorkflowAnnotation)
    .addNode("coordinator.runtimeFrame", createCoordinatorStepNode("runtimeFrame", coordinatorPrompts.runtimeFrame, emit))
    .addNode("coordinator.actorRouting", createCoordinatorStepNode("actorRouting", coordinatorPrompts.actorRouting, emit))
    .addNode("coordinator.interactionPolicy", createCoordinatorStepNode("interactionPolicy", coordinatorPrompts.interactionPolicy, emit))
    .addNode("coordinator.outcomeDirection", createCoordinatorStepNode("outcomeDirection", coordinatorPrompts.outcomeDirection, emit))
    .addNode("coordinator.apply", (state) => coordinatorNode(state, emit, roundDelayMs, waitForNextRound, isCanceled, saveState))
    .addEdge(START, "coordinator.runtimeFrame")
    .addEdge("coordinator.runtimeFrame", "coordinator.actorRouting")
    .addEdge("coordinator.actorRouting", "coordinator.interactionPolicy")
    .addEdge("coordinator.interactionPolicy", "coordinator.outcomeDirection")
    .addEdge("coordinator.outcomeDirection", "coordinator.apply")
    .addEdge("coordinator.apply", END)
    .compile()
}
