/**
 * Purpose: Define the trajectories instruction for this workflow.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/simulation/outputs/analysis/branch.ts.
 * Related: src/backend/core/simulation/outputs/analysis/branch.ts, src/backend/core/prompts/blocks.ts
 */
export const instruction = "Explain ordered developments and branching decisions observed in the supplied worlds. Only categories with assigned worlds are observed paths; if all worlds are unclassified, say no recurring path can be established and describe the recorded sequence without inventing categories. Use supplied world counts, never real-world probabilities. Disclose unclassified or unavailable worlds and differing assumptions."
