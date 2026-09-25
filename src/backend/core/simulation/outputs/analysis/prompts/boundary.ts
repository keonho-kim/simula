/**
 * Purpose: Request the internal and external boundary for a report perspective.
 * Pattern: Prompt definition.
 * Usage: Called by analytical perspective generation.
 * Related: src/backend/core/simulation/outputs/analysis/perspective.ts
 */
export const boundaryInstructions = "Distinguish the scenario's internal decision boundary from relevant external conditions in one short sentence. Mark a missing side as unspecified; do not invent actors, source facts, forecasts or JSON."
