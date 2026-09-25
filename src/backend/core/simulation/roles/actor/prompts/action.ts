/**
 * Purpose: Build the actor action model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/actor/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import { compactText, scalePromptLimit } from "@/backend/core/prompts/prompt"
import { actionPromptOutputs } from "./context"
import type { ActorPromptBuilder } from "./contracts"

export const action: ActorPromptBuilder = (state, partial) =>
    `Actor action.
Return exactly one allowed output.
Use an action id when this actor should act this round.
Compare the listed usage conditions with your current goal; choose a concrete mechanism rather than repeating the first option.
Use no_action only when holding position is the best choice.
Stay within channels this actor can realistically use from their role, relationships, workplace, public position, or current event context.
Do not jump to private or semi-public contact with distant executives, officials, or field actors unless the scenario context makes that access plausible.
No explanation, labels, markdown, or punctuation.

${renderPromptBlock("SIMULATION", `Round: ${state.roundIndex}`)}

${renderPromptBlock("PREVIOUS_RESULT", `Thought: ${compactText(partial.thought, scalePromptLimit(320, state.scenario.controls))}`)}

${renderPromptBlock("OPTIONS", `Allowed outputs:
${actionPromptOutputs(state)}
- no_action (hold position this round)`)}`
