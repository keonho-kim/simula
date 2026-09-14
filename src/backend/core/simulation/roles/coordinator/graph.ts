import { END, START, StateGraph } from "@langchain/langgraph"
import type { RunEvent } from "@/shared"
import { WorkflowAnnotation } from "@/backend/core/simulation/workflow/state"
import { coordinatorNode, createCoordinatorStepNode } from "@/backend/core/simulation/roles/coordinator/nodes"
import { coordinatorPrompts } from "@/backend/core/simulation/roles/coordinator/prompts"

export function createCoordinatorGraph(
  emit: (event: RunEvent) => Promise<void>,
  roundDelayMs = 0,
  waitForNextRound?: (roundIndex: number) => Promise<void>,
  isCanceled?: () => boolean
) {
  return new StateGraph(WorkflowAnnotation)
    .addNode("coordinator.runtimeFrame", createCoordinatorStepNode("runtimeFrame", coordinatorPrompts.runtimeFrame, emit))
    .addNode("coordinator.actorRouting", createCoordinatorStepNode("actorRouting", coordinatorPrompts.actorRouting, emit))
    .addNode("coordinator.interactionPolicy", createCoordinatorStepNode("interactionPolicy", coordinatorPrompts.interactionPolicy, emit))
    .addNode("coordinator.outcomeDirection", createCoordinatorStepNode("outcomeDirection", coordinatorPrompts.outcomeDirection, emit))
    .addNode("coordinator.apply", (state) => coordinatorNode(state, emit, roundDelayMs, waitForNextRound, isCanceled))
    .addEdge(START, "coordinator.runtimeFrame")
    .addEdge("coordinator.runtimeFrame", "coordinator.actorRouting")
    .addEdge("coordinator.actorRouting", "coordinator.interactionPolicy")
    .addEdge("coordinator.interactionPolicy", "coordinator.outcomeDirection")
    .addEdge("coordinator.outcomeDirection", "coordinator.apply")
    .addEdge("coordinator.apply", END)
    .compile()
}
