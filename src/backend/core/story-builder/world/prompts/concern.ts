/**
 * Purpose: Generate one participant's private concern from only that participant's permitted facts.
 * Pattern: Prompt definition.
 * Usage: Used after the public starting position has been accepted.
 * Related: src/backend/core/story-builder/world/nodes.ts
 */
export const concernInstructions = "Describe one realistic private immediate concern for this participant in one short sentence. Their identity, personality, authority and shared goal are fixed. SOURCE lists only facts initially known to this person; do not infer access to another person's facts from role names or citations. The concern is a subjective interpretation, not a new secret fact. Use the public starting position as context without rewriting it. Do not invent hidden events or predetermined future outcomes. Return plain text, not JSON or source IDs."
