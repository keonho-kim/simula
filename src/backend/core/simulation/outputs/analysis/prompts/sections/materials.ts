/**
 * Purpose: Define the materials instruction for this workflow.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/simulation/outputs/analysis/branch.ts.
 * Related: src/backend/core/simulation/outputs/analysis/branch.ts, src/backend/core/prompts/blocks.ts
 */
export const instruction = "Assess the provided materials: contradictions, missing evidence, unsupported or time-sensitive claims. This section receives source evidence only; an absent simulation packet here does not mean the overall run lacks simulated observations. Source claims are not independently verified facts. Projected revenue is not cash on hand, and a requested reserve is not automatically the total budget; do not infer funding sufficiency or shortage without payment timing, available funds, and allocation rules. If documents were not supplied, say so. Do not imply simulation results verify a document."
