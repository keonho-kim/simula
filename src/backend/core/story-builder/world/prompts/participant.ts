/**
 * Purpose: Define the participant model instruction.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/story-builder/world/nodes.ts.
 * Related: src/backend/core/story-builder/world/nodes.ts, src/backend/core/prompts/blocks.ts
 */
export const participantInstructions = "Describe only this participant's initial public position in one short sentence using the public opening and publicly available source facts. Identity and authority are fixed. Do not generate private concerns, hidden knowledge, dialogue, completed actions, future outcomes or other participants' motives. SOURCE contains only publicly known facts. Return plain text, not JSON."
