/**
 * Purpose: Request a unique roster using scenario-defined names.
 * Pattern: Simple Module.
 * Usage: Imported by the owning workflow.
 * Related: src/backend/core/simulation/roles/generator/roster.ts
 */
import { renderPromptBlocks } from "@/backend/core/prompts/blocks"

export function renderRosterPrompt(expectedCount: number, plannerDigest: string, scenarioText: string): string {
  return `Generator roster.
Return exactly one line with ${expectedCount} entries.
Format exactly: name: short role; name: short role; name: short role
Use exact person, organization, or line names that appear in the scenario.
If the scenario has a "Key Actors" or "주요 등장 인물" section, treat that section's bullet names as the authoritative actor candidates.
Prefer those named actor candidates over places, meetings, channels, topics, or abstract events.
Every actor must be a speaking-capable decision maker, stakeholder, organization unit, or accountable role.
Never use products, product lines, promotions, campaigns, events, offers, documents, channels, conditions, or metrics as actors.
Do not invent Korean names, generic placeholders, or new people when named scenario actors exist.
No JSON, markdown, headings, numbering, bullets, explanations, or line breaks.

${renderPromptBlocks({ SCENARIO: scenarioText, PREVIOUS_RESULT: plannerDigest })}`
}
