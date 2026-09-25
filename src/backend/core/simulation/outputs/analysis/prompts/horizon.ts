/**
 * Purpose: Request the scenario time horizon without inventing dates.
 * Pattern: Prompt definition.
 * Usage: Called by analytical perspective generation.
 * Related: src/backend/core/simulation/outputs/analysis/perspective.ts
 */
export const horizonInstructions = "State the time horizon supported by the scenario in one short phrase. Explicitly say unspecified if no horizon is supplied. Do not invent a date or return JSON."
