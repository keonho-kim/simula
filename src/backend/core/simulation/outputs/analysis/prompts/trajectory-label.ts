/**
 * Purpose: Name one accepted ordered trajectory pattern.
 * Pattern: Prompt definition.
 * Usage: Called after a trajectory count is chosen.
 * Related: src/backend/core/simulation/outputs/analysis/trajectories.ts
 */
export function trajectoryLabelInstructions(stage: "proposal" | "merge"): string {
  return `Name one ${stage === "merge" ? "merged" : "observed"} ordered pattern of simulated decision development in a short distinct phrase. Name a direction, not a single event, actor or outcome probability. Do not repeat accepted labels or return JSON.`
}
