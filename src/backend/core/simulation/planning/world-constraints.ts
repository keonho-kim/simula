/**
 * Purpose: Supply immutable prepared-world constraints without private actor starting concerns.
 * Pattern: Pure prompt projection.
 * Usage: Shared by Planner and Coordinator model inputs.
 * Related: src/shared/world-story.ts, src/backend/core/simulation/roles/planner/nodes.ts
 */
import type { WorldStory } from "@/shared/world-story"

export function renderWorldConstraints(world: WorldStory | undefined): string {
  if (!world) return ""
  return `Confirmed world constraints are authoritative. Preserve identities, authority, action limits, and completion conditions. Possible events do not authorize changes to fixed source facts or preselected outcomes.
${JSON.stringify({ participants: world.participants.map(({ name, authority }) => ({ name, authority })),
    constraints: world.constraints, actionScope: world.actionScope, endConditions: world.endConditions, informationFlow: world.informationFlow })}`
}
