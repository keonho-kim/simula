/**
 * Purpose: Choose a bounded number of distinct simulated trajectory patterns.
 * Pattern: Prompt definition.
 * Usage: Called by proposal and merge frontiers before naming categories.
 * Related: src/backend/core/simulation/outputs/analysis/trajectories.ts
 */
export function trajectoryCountInstructions(stage: "proposal" | "merge"): string {
  return stage === "proposal"
    ? "Count the distinct ordered patterns of how the supplied simulated worlds developed, not event titles. Return only one supplied digit. Do not invent diversity or treat the same direction as multiple patterns."
    : "Count the distinct ordered patterns after merging synonymous candidate trajectories. Return only one supplied digit. Preserve meaningful differences without inventing a new development."
}
