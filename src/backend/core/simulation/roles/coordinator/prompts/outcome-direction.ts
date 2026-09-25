/**
 * Purpose: Build the coordinator outcome-direction model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/coordinator/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import { compactText, renderOutputLengthGuide, scalePromptLimit } from "@/backend/core/prompts/prompt"
import type { CoordinatorPromptBuilder } from "./contracts"

export const outcomeDirection: CoordinatorPromptBuilder = (current, partial) =>
    `Coordinator outcomeDirection. Return 2 short sentences naming end-state pressure without resolving it.
${renderOutputLengthGuide(current.scenario.controls, "outcome direction")}

${renderPromptBlock("PREVIOUS_RESULT", `Frame: ${compactText(partial.runtimeFrame, scalePromptLimit(250, current.scenario.controls))}
Routing: ${compactText(partial.actorRouting, scalePromptLimit(250, current.scenario.controls))}
Policy: ${compactText(partial.interactionPolicy, scalePromptLimit(250, current.scenario.controls))}`)}`
