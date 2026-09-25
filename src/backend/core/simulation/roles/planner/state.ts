/**
 * Purpose: Project Planner trace into a bounded simulation plan and planned events.
 * Pattern: Pure state projection.
 * Usage: Called after Planner generation and before actor construction.
 * Related: src/backend/core/simulation/roles/planner/prompts/major-events.ts, src/backend/core/simulation/roles/planner/events/assignment.ts
 */
import type { PlannedEvent, PlannerTrace, PlannerTraceStep, ScenarioDigest, ScenarioInput, SimulationState } from "@/shared"
import { renderScenarioDigest } from "@/backend/core/simulation/planning/digest"

export const PLANNER_STEPS: PlannerTraceStep[] = [
  "coreSituation",
  "actorPressures",
  "conflictDynamics",
  "simulationDirection",
  "majorEvents",
]

export function getPlannerTrace(state: SimulationState): PlannerTrace {
  const trace = state.roleTraces.find((trace) => trace.role === "planner")
  return trace?.role === "planner" ? trace : emptyPlannerTrace()
}

export function plannerTracePartial(trace: PlannerTrace): Partial<Record<PlannerTraceStep, string>> {
  return Object.fromEntries(PLANNER_STEPS.map((step) => [step, trace[step]]))
}

export function emptyPlannerTrace(): PlannerTrace {
  return {
    role: "planner",
    coreSituation: "",
    actorPressures: "",
    conflictDynamics: "",
    simulationDirection: "",
    majorEvents: "",
    retryCounts: {
      coreSituation: 0,
      actorPressures: 0,
      conflictDynamics: 0,
      simulationDirection: 0,
      majorEvents: 0,
    },
  }
}

export function applyPlannerTrace(state: SimulationState, scenario: ScenarioInput, trace: PlannerTrace): SimulationState {
  const scenarioDigest: ScenarioDigest = {
    coreSituation: trace.coreSituation,
    actorPressures: trace.actorPressures,
    conflictDynamics: trace.conflictDynamics,
    simulationDirection: trace.simulationDirection,
  }
  const majorEvents = parsePlannerMajorEvents(trace.majorEvents, scenario.controls.maxRound ?? 8,
    scenario.controls.autonomousProgress === true)
  return {
    ...state,
    plan: {
      interpretation: scenarioDigest.coreSituation,
      backgroundStory: renderScenarioDigest(scenarioDigest),
      scenarioDigest,
      actionCatalog: {},
      majorEvents,
    },
  }
}

export function parsePlannerMajorEvents(value: string, maxRound: number, autonomousProgress = false): PlannedEvent[] {
  const lines = value
    .replace(/```[\s\S]*?```/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
  const requested = autonomousProgress ? Math.max(3, maxRound) : maxRound
  if (lines.length < Math.min(3, requested)) {
    throw new Error(`planner.majorEvents must produce at least ${Math.min(3, requested)} major events.`)
  }
  return lines.slice(0, requested).map((line, index) => {
    const separatorIndex = line.includes(" - ") ? line.indexOf(" - ") : line.indexOf(":")
    const title = separatorIndex > 0 ? line.slice(0, separatorIndex).trim() : `Major Event ${index + 1}`
    const summary = separatorIndex > 0 ? line.slice(separatorIndex + (line.includes(" - ") ? 3 : 1)).trim() : line
    return {
      id: `event-${index + 1}`,
      title: title || `Major Event ${index + 1}`,
      summary,
      status: "pending" as const,
      participantIds: [],
    }
  })
}
