/**
 * Purpose: Request one short summary for a scoped conclusion paragraph.
 * Pattern: Prompt definition.
 * Usage: Called by the report conclusion workflow before its paragraph.
 * Related: src/backend/core/simulation/outputs/analysis/conclusion.ts
 */
import { conclusionInstructions as INSTRUCTIONS } from "./conclusion"

export function conclusionSummaryInstructions(id: keyof typeof INSTRUCTIONS): string {
  return `Analytical report conclusion summary. ${INSTRUCTIONS[id]} Write one concise sentence, ideally within 350 characters, for this scope only. Do not write the full paragraph, other scopes or JSON.`
}
