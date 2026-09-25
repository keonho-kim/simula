/**
 * Purpose: Build the actor intent model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/actor/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import { compactText, renderOutputLengthGuide, scalePromptLimit } from "@/backend/core/prompts/prompt"
import { actorActionSummary, targetSelectionSummary } from "./context"
import { normalizePromptLanguage } from "@/backend/core/prompts/language"
import type { ActorPromptBuilder } from "./contracts"

export const intent: ActorPromptBuilder = (state, partial) =>
    `Actor intent. Return one sentence explaining this actor's choice in the current round.
${textGuide(state.scenario.language)}
${renderOutputLengthGuide(state.scenario.controls, "actor intent")}
Natural-language output must use actor names and action labels, not internal ids.

${renderPromptBlock("ACTOR", { name: state.actor.name })}

${renderPromptBlock("SIMULATION", `Round ${state.roundIndex}: ${state.event.title}. ${compactText(state.event.summary, scalePromptLimit(300, state.scenario.controls))}
Pre-round: ${compactText(state.roundDigest.preRound.content, scalePromptLimit(240, state.scenario.controls))}`)}

${renderPromptBlock("PREVIOUS_RESULT", `Thought: ${compactText(partial.thought, scalePromptLimit(350, state.scenario.controls))}
Target: ${targetSelectionSummary(state, partial.target)}
Action: ${actorActionSummary(state, partial.action)}`)}`

function textGuide(language: string | undefined): string {
  const korean = normalizePromptLanguage(language) === "ko"
  const instruction = korean ? "앞선 생각과 현재 상황을 바탕으로, 선택한 행동으로 이번에 이루려는 목적 하나를 한 문장으로 작성하세요. 생각을 요약하거나 상대에게 할 대사를 쓰지 마세요." : "Using the preceding thought and current situation, state one purpose of the selected action this turn in one sentence. Do not summarize the thought or write dialogue."
  return `${instruction}\n${korean
    ? "현재 단계의 내용만 출력하세요. 생각·의도·발화를 함께 쓰거나 제목을 붙이지 마세요."
    : "Output only the current step. Do not include other steps or a heading."}`
}
