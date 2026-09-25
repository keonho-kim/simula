/**
 * Purpose: Build the generator/cards role model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/generator/cards/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import type { ActorCardPromptBuilder } from "./contracts"

export const role: ActorCardPromptBuilder = (state) =>
    `Generator actor card role.
Return only one concise role label for this assigned actor.
You may refine the role seed, but do not rename this actor.

${renderPromptBlock("ACTOR", `Actor index: ${state.actorIndex}
Assigned name: ${state.assignedName}
Role seed: ${state.roleSeed}`)}

${renderPromptBlock("SCENARIO", `Full roster:
${renderRoster(state.fullRoster)}
Planner scenario digest:
${state.plannerDigest}`)}`

function renderRoster(roster: Array<{ index: number; name: string; roleSeed: string }>): string {
  return roster.map((entry) => `${entry.index}. ${entry.name} - ${entry.roleSeed}`).join("\n")
}
