/**
 * Purpose: Identify one optional opening detail introduced by world preparation.
 * Pattern: Prompt definition.
 * Usage: Called after the opening setting and summary are accepted.
 * Related: src/backend/core/story-builder/world/nodes.ts
 */
export const openingAssumptionInstructions = "Compare the accepted public opening with the confirmed scenario and its allowed variation. If no optional detail was introduced, return only 0. Otherwise state one concrete opening detail that is an assumption, not a document fact, in one short sentence. Do not add a new event, budget, date, identity, private fact or outcome. Return plain text, not JSON."
