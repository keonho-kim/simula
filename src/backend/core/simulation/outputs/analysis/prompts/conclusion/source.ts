/**
 * Purpose: Define the source instruction for this workflow.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/simulation/outputs/analysis/conclusion.ts.
 * Related: src/backend/core/simulation/outputs/analysis/conclusion.ts, src/backend/core/prompts/blocks.ts
 */
export const instruction = "Explain the initial decision problem and the supplied evidence that materially constrains it. Separate observations, proposals, estimates, commitments and verified completion. Discuss the most consequential gap or contradiction and why it matters for the scenario objective. Assess only supplied source evidence; do not introduce simulated events or claim that a proposal is feasible merely because its arithmetic is positive. If source evidence is absent, state the limitation concisely rather than padding this section."
