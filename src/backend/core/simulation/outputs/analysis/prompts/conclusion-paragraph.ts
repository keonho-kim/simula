/**
 * Purpose: Define the conclusion-paragraph model instruction.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/simulation/outputs/analysis/conclusion.ts.
 * Related: src/backend/core/simulation/outputs/analysis/conclusion.ts, src/backend/core/prompts/blocks.ts
 */
import { conclusionInstructions as INSTRUCTIONS } from "./conclusion"
export function conclusionParagraphInstructions(id: keyof typeof INSTRUCTIONS): string {
  return `Analytical report conclusion paragraph. ${INSTRUCTIONS[id]} Write only this paragraph in 3–5 connected sentences, within 1,800 characters. Use the accepted short summary as context, not a separate output field. Do not write the other conclusion paragraphs or JSON.`
}
