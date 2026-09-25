/**
 * Purpose: Request the initial public situation from an accepted opening setting.
 * Pattern: Prompt definition.
 * Usage: Called by the per-world StoryBuilder opening node.
 * Related: src/backend/core/story-builder/world/nodes.ts
 */
export const openingSummaryInstructions = "Describe what is immediately happening in this public scene in one short sentence. Use the accepted setting and publicly available source facts; do not infer private actor knowledge from citations or information routes. Treat confirmed scenario facts as premises. Do not invent dialogue, completed actions, future events or a predetermined result. Return plain text, not JSON."
