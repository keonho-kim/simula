import type { RoleTrace, RoleTraceStep, SimulationRole } from "@simula/shared"
import type { WorkflowState } from "../../state"

const STEPS: RoleTraceStep[] = ["thought", "target", "action", "intent"]

export function getRoleTrace(state: WorkflowState, role: SimulationRole): RoleTrace {
  return state.simulation.roleTraces.find((trace) => trace.role === role) ?? emptyRoleTrace(role)
}

export function tracePartial(trace: RoleTrace): Partial<Record<RoleTraceStep, string>> {
  return Object.fromEntries(STEPS.map((step) => [step, trace[step]]))
}

function emptyRoleTrace(role: SimulationRole): RoleTrace {
  return {
    role,
    thought: "",
    target: "",
    action: "",
    intent: "",
    retryCounts: {
      thought: 0,
      target: 0,
      action: 0,
      intent: 0,
    },
  }
}
