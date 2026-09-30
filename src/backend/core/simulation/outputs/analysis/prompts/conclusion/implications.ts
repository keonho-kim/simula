/**
 * Purpose: Define the implications instruction for this workflow.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/simulation/outputs/analysis/conclusion.ts.
 * Related: src/backend/core/simulation/outputs/analysis/conclusion.ts, src/backend/core/prompts/blocks.ts
 */
export const instruction = "Integrate the accepted document assessment, simulated observations, and section interpretations into a defensible answer to the scenario objective. Explain which conditions and actor responses account for the observed differences, separating an interpretation from established causation. Contrast recurring and rare paths only if classified worlds support that comparison; a single run supports a sequence, not a frequency. Prioritize what should be checked or clarified next, who could verify it, and which decision depends on that check when the supplied context supports those details. Explain conditional implications, missing evidence, and the next real-world checks. A simulated incident may motivate checking whether a risk exists; it cannot establish a real repair obligation. Do not certify feasibility, solvency, or available funds without evidence. Acknowledge failed sections and incomplete world coverage. State what remains unknown without inventing a missing analysis."
