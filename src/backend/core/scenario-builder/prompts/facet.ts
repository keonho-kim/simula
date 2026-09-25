/**
 * Purpose: Define the facet model instruction.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/scenario-builder/design.ts.
 * Related: src/backend/core/scenario-builder/design.ts, src/backend/core/prompts/blocks.ts
 */
export function facetInstructions(facet: string): string {
  return `Develop one plausible ${facet} pressure for this decision situation. Use the supplied evidence as context, but present generated detail as a hypothetical scenario assumption rather than a verified source fact.`
}
