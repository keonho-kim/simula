/**
 * Purpose: Define the conclusion-paragraph model instruction.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/simulation/outputs/analysis/conclusion.ts.
 * Related: src/backend/core/simulation/outputs/analysis/conclusion.ts, src/backend/core/prompts/blocks.ts
 */
import { conclusionInstructions as INSTRUCTIONS } from "./conclusion"
export function conclusionParagraphInstructions(id: keyof typeof INSTRUCTIONS): string {
  return `Analytical report conclusion paragraph. ${INSTRUCTIONS[id]} Write this scope as 2–3 substantive connected paragraphs, roughly 6–9 sentences, within 3,200 characters. Develop a clear finding, explain the concrete evidence and actor decisions behind it, then describe its conditional meaning and unresolved limits. Use specific actors, choices, constraints and recorded outcomes when present; do not substitute generic caution for analysis. Do not repeat the same evidence or disclaimer to fill space. If evidence is absent, state the gap concisely instead of inventing details. Use the accepted summary as a starting point and expand its reasoning. Do not write other scopes, headings, lists or JSON.`
}
