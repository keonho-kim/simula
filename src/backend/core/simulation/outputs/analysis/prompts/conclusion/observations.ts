/**
 * Purpose: Define the observations instruction for this workflow.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/simulation/outputs/analysis/conclusion.ts.
 * Related: src/backend/core/simulation/outputs/analysis/conclusion.ts, src/backend/core/prompts/blocks.ts
 */
export const instruction = "Explain the recorded sequence: the actors' consequential choices, reactions, turning points, accepted commitments and unresolved decisions. Identify the supported differences between simulated worlds and what preceded those differences, without treating sequence as proof of causation. Only categories with assigned worlds are observed paths; distinguish recurring from rare paths using supplied counts and disclose unclassified worlds. A single world supports an account of its development, not a frequency claim. Keep these observations explicitly scoped to the simulation, not real incidents, real-world probabilities or mandatory real-world repairs."
