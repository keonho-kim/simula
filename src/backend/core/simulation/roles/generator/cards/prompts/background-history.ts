/**
 * Purpose: Build the generator/cards background-history model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/generator/cards/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import type { ActorCardPromptBuilder } from "./contracts"

export const backgroundHistory: ActorCardPromptBuilder = (state) =>
    `Generator actor card background history.
Return one compact paragraph describing the actor's relevant past and current stake.
Do not rename this actor.

${renderPromptBlock("ACTOR", `Role: ${state.card.role}
Name: ${state.assignedName}`)}

${renderPromptBlock("SCENARIO", `Planner scenario digest:
${state.plannerDigest}`)}`
