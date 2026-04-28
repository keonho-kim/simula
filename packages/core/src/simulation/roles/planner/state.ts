import type { PlannedEvent, PlannerTrace, PlannerTraceStep, ScenarioDigest, ScenarioInput, SimulationState } from "@simula/shared"
import { renderScenarioDigest } from "../../plan"

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
  const majorEvents = parsePlannerMajorEvents(trace.majorEvents, scenario.controls.maxRound ?? 8)
  return {
    ...state,
    plan: {
      interpretation: scenarioDigest.coreSituation,
      backgroundStory: renderScenarioDigest(scenarioDigest),
      scenarioDigest,
      actionCatalog: [],
      majorEvents,
    },
  }
}

export function parsePlannerMajorEvents(value: string, maxRound: number): PlannedEvent[] {
  const lines = value
    .replace(/```[\s\S]*?```/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
  const events = lines.map((line, index) => {
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
  if (events.length < Math.min(3, maxRound)) {
    throw new Error("planner.majorEvents must produce at least 3 major events.")
  }
  return events
}
