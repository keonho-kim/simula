/**
 * Purpose: Define the score model instruction.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/simulation/outputs/analysis/branch.ts.
 * Related: src/backend/core/simulation/outputs/analysis/branch.ts, src/backend/core/prompts/blocks.ts
 */
export const scoreInstructions = "Analytical report ordinal influence score. Use the shared focal objective and horizon. Rubric: 0 supported negligible influence, 1 limited, 2 material, 3 strong, 4 decisive; ? means insufficient evidence. High threat/weakness influence is adverse, not success. Return only the selected value. The program retains the accepted finding and reference IDs. Do not compute a success probability."
