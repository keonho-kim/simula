/**
 * Purpose: Define the scenario instruction for this workflow.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/simulation/outputs/analysis/branch.ts.
 * Related: src/backend/core/simulation/outputs/analysis/branch.ts, src/backend/core/prompts/blocks.ts
 */
export const instruction = "Assess scenario realism, assumptions, coverage, and sensitivity. Compare fixed constraints with recorded outcomes and identify important untested alternatives. A simulated resource pressure is not proof of a real shortage or technical defect. Do not treat generated assumptions as source facts."
