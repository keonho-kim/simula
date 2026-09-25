/**
 * Purpose: Define the synthesis model instruction.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/simulation/outputs/analysis/summaries.ts.
 * Related: src/backend/core/simulation/outputs/analysis/summaries.ts, src/backend/core/prompts/blocks.ts
 */
export function synthesisInstructions(required: string[], childCount: number): string {
  return `Analytical report synthesis. Summarize all ${childCount} accepted child summaries in at most three short sentences and 900 characters. Preserve the decisive observations, contradictions, uncertainty, conditions, and ordering; omit repetitive explanation. If they describe different worlds, retain their identities and distinguish shared from divergent observations. Do not turn a source claim or simulated development into a real-world fact or forecast. The program retains reference IDs. These children retain ${required.length} recorded-observation references; when this count is positive, do not claim there were no recorded observations.`
}
