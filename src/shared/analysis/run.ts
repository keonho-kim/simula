/**
 * Purpose: Compose network, behavior, and coordinator metrics into one run analysis.
 * Pattern: Facade.
 * Usage: Called by browser report models and shared analysis tests.
 * Related: src/shared/analysis/network.ts, src/shared/analysis/metrics.ts
 */
import type { SimulationState } from "@/shared/simulation"
import type { RunAnalysis } from "./types"
import { calculateNetworkDynamics } from "./network"
import { calculateBehaviorDiversity, calculateCoordinatorAlignment } from "./metrics"
import { average } from "./statistics"

export function calculateRunAnalysis(state: SimulationState): RunAnalysis {
  const network = calculateNetworkDynamics(state)
  const behavior = calculateBehaviorDiversity(state)
  const coordinator = calculateCoordinatorAlignment(state)

  return {
    network,
    behavior,
    coordinator,
    summary: {
      averageActionEntropy: average(behavior.map((metric) => metric.normalizedActionTypeEntropy)),
      averageVisibilityEntropy: average(behavior.map((metric) => metric.normalizedVisibilityEntropy)),
      averageRepeatRate: average(behavior.map((metric) => metric.consecutiveRepeatRate)),
      averageEventAlignment: average(coordinator.map((metric) => metric.jaccardAlignment)),
      completedEventCount: (state.plan?.majorEvents ?? []).filter((event) => event.status === "completed").length,
      totalEventCount: state.plan?.majorEvents.length ?? 0,
    },
  }
}
