/**
 * Purpose: Request the initial public place and moment for one prepared world.
 * Pattern: Prompt definition.
 * Usage: Called by the per-world StoryBuilder opening node.
 * Related: src/backend/core/story-builder/world/nodes.ts
 */
export const openingSettingInstructions = "Describe the initial public place and moment in one short sentence. SOURCE contains only facts available to everyone. Keep confirmed identities, budgets and dates fixed; vary only opening details expressly permitted by the scenario. Do not add private knowledge, dialogue, future events or a predetermined outcome. Return plain text, not JSON."
