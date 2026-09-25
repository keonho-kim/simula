/**
 * Purpose: Build the coordinator interaction-policy model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/coordinator/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import { compactText, renderOutputLengthGuide, scalePromptLimit } from "@/backend/core/prompts/prompt"
import type { CoordinatorPromptBuilder } from "./contracts"

export const interactionPolicy: CoordinatorPromptBuilder = (current, partial) =>
    `Coordinator interactionPolicy. Return 2 short sentences for public, semi-public, private, solitary boundaries.
${renderOutputLengthGuide(current.scenario.controls, "interaction policy")}

${renderPromptBlock("PREVIOUS_RESULT", `Frame: ${compactText(partial.runtimeFrame, scalePromptLimit(300, current.scenario.controls))}
Routing: ${compactText(partial.actorRouting, scalePromptLimit(350, current.scenario.controls))}`)}`
