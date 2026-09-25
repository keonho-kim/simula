/**
 * Purpose: Define the evidence model instruction.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/simulation/outputs/analysis/summaries.ts.
 * Related: src/backend/core/simulation/outputs/analysis/summaries.ts, src/backend/core/prompts/blocks.ts
 */
export function evidenceInstructions(required: string[]): string {
  return `Analytical report evidence. Summarize these bounded fragments in at most three sentences. Preserve quantities, units, conditions, opposing evidence, causal order, and unresolved commitments. Distinguish source claims, scenario assumptions, and recorded observations. Do not infer guaranteed outcomes. The program retains reference IDs. This packet has ${required.length} recorded-observation references; a positive count means observations exist, while zero applies only to this packet, not the whole run.`
}
