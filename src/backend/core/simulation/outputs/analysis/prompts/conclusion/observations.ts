/**
 * Purpose: Define the observations instruction for this workflow.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/simulation/outputs/analysis/conclusion.ts.
 * Related: src/backend/core/simulation/outputs/analysis/conclusion.ts, src/backend/core/prompts/blocks.ts
 */
export const instruction = "Describe only what happened in the supplied simulated worlds, in causal order. Identify events and participant responses as hypothetical simulation observations throughout, including the summary. A simulated defect is not a real defect requiring repair. Use supplied counts and classification; unclassified worlds are not recurring paths. Do not predict real-world probability or prescribe real-world repairs."
