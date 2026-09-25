/**
 * Purpose: Build the coordinator actor-routing model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/coordinator/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import { compactLines, compactText, renderOutputLengthGuide, scalePromptLimit } from "@/backend/core/prompts/prompt"
import type { CoordinatorPromptBuilder } from "./contracts"

export const actorRouting: CoordinatorPromptBuilder = (current, partial) =>
    `Coordinator actorRouting. Return 2 short sentences on which pressures should interact. Do not pick one target.
${renderOutputLengthGuide(current.scenario.controls, "coordinator routing")}

${renderPromptBlock("PREVIOUS_RESULT", `Frame: ${compactText(partial.runtimeFrame, scalePromptLimit(350, current.scenario.controls))}`)}

${renderPromptBlock("ACTOR", `Actors:
${compactLines(current.simulation.actors.map((actor) => `- ${actor.name} (${actor.role}): ${actor.preference}`), 10, scalePromptLimit(900, current.scenario.controls))}`)}`
