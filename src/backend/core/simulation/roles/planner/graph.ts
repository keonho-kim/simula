import { createPlannerActionsNode } from "./actions/node"
import { END, START, StateGraph } from "@langchain/langgraph"
import type { RunEvent } from "@/shared"
import { WorkflowAnnotation } from "@/backend/core/simulation/workflow/state"
import { createPlannerStepNode, plannerNode } from "@/backend/core/simulation/roles/planner/nodes"
import { plannerPrompts } from "@/backend/core/simulation/roles/planner/prompts"

export function createPlannerGraph(emit: (event: RunEvent) => Promise<void>) {
  return new StateGraph(WorkflowAnnotation)
    .addNode("planner.coreSituation", createPlannerStepNode("coreSituation", plannerPrompts.coreSituation, emit))
    .addNode("planner.actorPressures", createPlannerStepNode("actorPressures", plannerPrompts.actorPressures, emit))
    .addNode("planner.conflictDynamics", createPlannerStepNode("conflictDynamics", plannerPrompts.conflictDynamics, emit))
    .addNode(
      "planner.simulationDirection",
      createPlannerStepNode("simulationDirection", plannerPrompts.simulationDirection, emit)
    )
    .addNode("planner.majorEvents", createPlannerStepNode("majorEvents", plannerPrompts.majorEvents, emit))
    .addNode("planner.apply", plannerNode)
    .addNode("planner.actionCatalog", createPlannerActionsNode(emit))
    .addEdge(START, "planner.coreSituation")
    .addEdge("planner.coreSituation", "planner.actorPressures")
    .addEdge("planner.actorPressures", "planner.conflictDynamics")
    .addEdge("planner.conflictDynamics", "planner.simulationDirection")
    .addEdge("planner.simulationDirection", "planner.majorEvents")
    .addEdge("planner.majorEvents", "planner.apply")
    .addEdge("planner.apply", "planner.actionCatalog")
    .addEdge("planner.actionCatalog", END)
    .compile()
}
