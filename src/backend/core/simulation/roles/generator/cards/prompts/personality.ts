/**
 * Purpose: Build the generator/cards personality model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/generator/cards/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import type { ActorCardPromptBuilder } from "./contracts"

export const personality: ActorCardPromptBuilder = (state) =>
    `Generator actor card personality.
Return one compact sentence describing how this actor behaves under pressure.
Do not rename this actor.

${renderPromptBlock("ACTOR", `Role: ${state.card.role}
Name: ${state.assignedName}`)}

${renderPromptBlock("PREVIOUS_RESULT", `Background history: ${state.card.backgroundHistory}`)}`
