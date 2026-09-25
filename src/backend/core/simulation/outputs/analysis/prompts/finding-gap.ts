/**
 * Purpose: Request one explicit uncertainty for an analytical branch.
 * Pattern: Prompt definition.
 * Usage: Called after accepted branch findings are known.
 * Related: src/backend/core/simulation/outputs/analysis/findings.ts
 */
export const findingGapInstructions = "Name one material missing fact, uncertainty or limitation in this branch in one short sentence. Return only 0 when no distinct gap is evident. Do not turn a simulated event into real-world evidence or return JSON."
