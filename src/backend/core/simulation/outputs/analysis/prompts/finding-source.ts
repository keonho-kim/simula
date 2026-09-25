/**
 * Purpose: Select a supplied reference for one branch finding.
 * Pattern: Prompt definition.
 * Usage: Called once for each requested analytical finding.
 * Related: src/backend/core/simulation/outputs/analysis/findings.ts
 */
export const findingSourceInstructions = "Choose the numbered reference that directly supports the next distinct finding. Return only its supplied index. Prefer a recorded interaction for claims about simulated behavior; a scenario premise is not an observed action. Do not invent an ID or cite an absent reference."
