import type { WorkflowState } from "../../state"
import { applyObserverRound } from "./state"

export async function observerNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
  return {
    simulation: applyObserverRound(state.simulation),
  }
}
