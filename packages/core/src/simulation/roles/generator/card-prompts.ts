import type { ActorCardStep } from "@simula/shared"
import type { ActorCardGraphState } from "./card-state"

export type ActorCardPromptBuilder = (state: ActorCardGraphState) => string

export const actorCardPrompts: Record<ActorCardStep, ActorCardPromptBuilder> = {
  role: (state) =>
    `Generator actor card role.
Return only one concise role label for this assigned actor.
You may refine the role seed, but do not rename this actor.

Actor index: ${state.actorIndex}
Assigned name: ${state.assignedName}
Role seed: ${state.roleSeed}
Full roster:
${renderRoster(state.fullRoster)}
Planner scenario digest:
${state.plannerDigest}`,
  backgroundHistory: (state) =>
    `Generator actor card background history.
Return one compact paragraph describing the actor's relevant past and current stake.
Do not rename this actor.

Role: ${state.card.role}
Name: ${state.assignedName}
Planner scenario digest:
${state.plannerDigest}`,
  personality: (state) =>
    `Generator actor card personality.
Return one compact sentence describing how this actor behaves under pressure.
Do not rename this actor.

Role: ${state.card.role}
Name: ${state.assignedName}
Background history: ${state.card.backgroundHistory}`,
  preference: (state) =>
    `Generator actor card preference.
Return one compact sentence describing what this actor wants and what tradeoff they prefer.
Do not rename this actor.

Role: ${state.card.role}
Name: ${state.assignedName}
Background history: ${state.card.backgroundHistory}
Personality: ${state.card.personality}`,
}

function renderRoster(roster: Array<{ index: number; name: string; roleSeed: string }>): string {
  return roster.map((entry) => `${entry.index}. ${entry.name} - ${entry.roleSeed}`).join("\n")
}
