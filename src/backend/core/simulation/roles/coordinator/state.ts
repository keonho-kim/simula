/**
 * Purpose: Initialize and project coordinator trace state.
 * Pattern: State factory.
 * Usage: Used by coordinator graph nodes and actor prompt context.
 * Related: src/shared/simulation.ts, src/backend/core/simulation/roles/coordinator/nodes.ts
 */
import type {
  CoordinatorTrace,
  CoordinatorTraceStep,
  SimulationState,
} from "@/shared"

export const COORDINATOR_STEPS: CoordinatorTraceStep[] = [
  "runtimeFrame",
  "actorRouting",
  "interactionPolicy",
  "outcomeDirection",
  "eventInjection",
  "eventResolution",
  "progressDecision",
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
    retryCounts: {
      runtimeFrame: 0,
      actorRouting: 0,
      interactionPolicy: 0,
      outcomeDirection: 0,
      eventInjection: 0,
      eventResolution: 0,
      progressDecision: 0,
    },
  }
}
