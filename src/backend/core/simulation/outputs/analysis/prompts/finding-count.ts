/**
 * Purpose: Choose how many independently supported findings a branch has.
 * Pattern: Prompt definition.
 * Usage: Called after the branch overview is accepted.
 * Related: src/backend/core/simulation/outputs/analysis/findings.ts
 */
export const findingCountInstructions = "Choose how many distinct findings are directly supported by the numbered references and branch summary. Return only one supplied digit. Choose 0 if the references do not support a concrete finding; do not force the maximum or count hypothetical outcomes as observations."
