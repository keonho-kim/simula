/**
 * Purpose: Request one finding supported by a selected reference.
 * Pattern: Prompt definition.
 * Usage: Called after the branch finding's reference index is accepted.
 * Related: src/backend/core/simulation/outputs/analysis/findings.ts
 */
export const findingTextInstructions = "Write one specific analytical finding in a short sentence using the selected reference and branch context. Explain the scenario or simulated observation without inventing a real-world outcome. If the reference is a simulation observation, name it as simulated. Do not repeat an accepted finding, write a source ID, or return JSON."
