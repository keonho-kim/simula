import type { WorkflowState } from "../../state"
import { getRoleTrace } from "../shared"
import { applyPlannerTrace } from "./state"

export async function plannerNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  const trace = getRoleTrace(state, "planner")
  return {
    simulation: applyPlannerTrace(state.simulation, state.scenario, trace),
  }
}
