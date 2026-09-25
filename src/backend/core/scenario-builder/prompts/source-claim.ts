/**
 * Purpose: Ask for one decision-relevant claim from one source block.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/scenario-builder/evidence.ts.
 * Related: src/backend/core/scenario-builder/evidence.ts
 */
export const sourceClaimInstructions = "State one factual, decision-relevant claim from this source block. Preserve its quantities, units and conditions. Return 0 if the block has no relevant fact. When visual interpretation and extracted page text differ, use the extracted text as authoritative. Do not invent a scenario or write source IDs."
