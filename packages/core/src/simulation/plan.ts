import type { ScenarioDigest, SimulationState } from "@simula/shared"

export function renderScenarioDigest(digest: ScenarioDigest): string {
  return `Core situation: ${digest.coreSituation}
Actor pressures: ${digest.actorPressures}
Conflict dynamics: ${digest.conflictDynamics}
Simulation direction: ${digest.simulationDirection}`
}

export function plannerDigestSummary(plan: SimulationState["plan"] | undefined, fallback: string): string {
  if (plan?.scenarioDigest) {
    return renderScenarioDigest(plan.scenarioDigest)
  }
  return plan?.backgroundStory || plan?.interpretation || fallback
}
