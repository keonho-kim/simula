/**
 * Purpose: Define the implications instruction for this workflow.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/simulation/outputs/analysis/conclusion.ts.
 * Related: src/backend/core/simulation/outputs/analysis/conclusion.ts, src/backend/core/prompts/blocks.ts
 */
export const instruction = "Integrate the accepted document assessment, simulated observations, and section interpretations. Explain conditional implications, missing evidence, and the next real-world checks. A simulated incident may motivate checking whether a risk exists; it cannot establish a real repair obligation. Do not certify feasibility, solvency, or available funds without evidence. Acknowledge failed sections and incomplete world coverage. State what remains unknown without inventing a missing analysis."
