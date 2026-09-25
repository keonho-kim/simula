/**
 * Purpose: Build the actor target model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/actor/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import { compactText, scalePromptLimit } from "@/backend/core/prompts/prompt"
import { actorActionSummary, targetPromptContext, targetPromptOutputs } from "./context"
import type { ActorPromptBuilder } from "./contracts"

export const target: ActorPromptBuilder = (state, partial) =>
    `Actor target.
Choose a direct target only when this actor has a realistic access path: existing relationship, shared team, formal meeting, public channel, operational chain, or clear scenario pressure.
Avoid unrealistic leaps across hierarchy, geography, or organization boundaries.
No explanation, names, markdown, or punctuation.
Return exactly one allowed output from Allowed outputs.
Use an actor id when the selected action is directed at another actor.
Use None only when the selected action is no_action or solitary.

${renderPromptBlock("ACTOR", `Actor: ${state.actor.name} (${state.actor.role}). ${compactText(state.actor.backgroundHistory, scalePromptLimit(180, state.scenario.controls))}`)}

${renderPromptBlock("PREVIOUS_RESULT", `Thought: ${compactText(partial.thought, 350)}
Action: ${actorActionSummary(state, partial.action)}`)}

${renderPromptBlock("OPTIONS", `Allowed outputs:
${targetPromptOutputs(state, partial.action)}

Target context:
${targetPromptContext(state, partial.action)}`)}`
