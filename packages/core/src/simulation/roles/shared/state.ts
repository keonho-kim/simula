import type { RoleTrace, RoleTraceStep, StandardRoleTrace, SimulationRole } from "@simula/shared"
import type { WorkflowState } from "../../state"

const STEPS: RoleTraceStep[] = ["thought", "target", "action", "intent"]

export function getRoleTrace(state: WorkflowState, role: Exclude<SimulationRole, "planner" | "coordinator" | "observer">): StandardRoleTrace {
  const trace = state.simulation.roleTraces.find((trace) => trace.role === role)
  return trace && isStandardRoleTrace(trace) ? trace : emptyRoleTrace(role)
}

export function tracePartial(trace: StandardRoleTrace): Partial<Record<RoleTraceStep, string>> {
  return Object.fromEntries(STEPS.map((step) => [step, trace[step]]))
}

function emptyRoleTrace(role: Exclude<SimulationRole, "planner" | "coordinator" | "observer">): StandardRoleTrace {
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

function isStandardRoleTrace(trace: RoleTrace): trace is StandardRoleTrace {
  return trace.role !== "planner" && trace.role !== "coordinator" && trace.role !== "observer"
}
