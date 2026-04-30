import type {
  CoordinatorTrace,
  CoordinatorTraceStep,
  SimulationState,
} from "@simula/shared"

export const COORDINATOR_STEPS: CoordinatorTraceStep[] = [
  "runtimeFrame",
  "actorRouting",
  "interactionPolicy",
  "outcomeDirection",
  "eventInjection",
  "eventResolution",
  "progressDecision",
  "extensionDecision",
]

export function getCoordinatorTrace(state: SimulationState): CoordinatorTrace {
  const trace = state.roleTraces.find((trace) => trace.role === "coordinator")
  return trace?.role === "coordinator" ? trace : emptyCoordinatorTrace()
}

export function coordinatorTracePartial(trace: CoordinatorTrace): Partial<Record<CoordinatorTraceStep, string>> {
  return Object.fromEntries(COORDINATOR_STEPS.map((step) => [step, trace[step]]))
}

export function emptyCoordinatorTrace(): CoordinatorTrace {
  return {
    role: "coordinator",
    runtimeFrame: "",
    actorRouting: "",
    interactionPolicy: "",
    outcomeDirection: "",
    eventInjection: "",
    eventResolution: "",
    progressDecision: "",
    extensionDecision: "",
    retryCounts: {
      runtimeFrame: 0,
      actorRouting: 0,
      interactionPolicy: 0,
      outcomeDirection: 0,
      eventInjection: 0,
      eventResolution: 0,
      progressDecision: 0,
      extensionDecision: 0,
    },
  }
}
