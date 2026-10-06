/**
 * Purpose: Build the generator/cards preference model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/generator/cards/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import type { ActorCardPromptBuilder } from "./contracts"

export const preference: ActorCardPromptBuilder = (state) =>
    `Generator actor card preference.
Return one compact sentence describing what this actor wants and what tradeoff they prefer.
Make the preferred outcome and what the actor is willing to give up specific to this role. Keep conflicting incentives plausible; do not make every actor simply want harmony or force a secret agenda.
Do not rename this actor.

${renderPromptBlock("ACTOR", `Role: ${state.card.role}
Name: ${state.assignedName}`)}

${renderPromptBlock("PREVIOUS_RESULT", `Background history: ${state.card.backgroundHistory}
Personality: ${state.card.personality}`)}`
