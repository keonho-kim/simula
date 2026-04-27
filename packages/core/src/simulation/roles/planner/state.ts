import type { PlannedEvent, RoleTrace, ScenarioInput, SimulationState } from "@simula/shared"

export function applyPlannerTrace(state: SimulationState, scenario: ScenarioInput, trace: RoleTrace): SimulationState {
  const majorEvents = buildMajorEvents(scenario.controls.numCast, trace)
  return {
    ...state,
    plan: {
      interpretation: trace.thought,
      backgroundStory: trace.action,
      actionCatalog: [],
      majorEvents,
    },
  }
}

function buildMajorEvents(numCast: number, trace: RoleTrace): PlannedEvent[] {
  const count = Math.min(3, Math.max(1, numCast))
  return Array.from({ length: count }, (_, index) => ({
    id: `event-${index + 1}`,
    title: `Major Event ${index + 1}`,
    summary: `${trace.target} creates actor pressure in beat ${index + 1}.`,
    status: "pending",
    participantIds: [`actor-${index + 1}`],
  }))
}
