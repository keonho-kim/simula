/**
 * Purpose: Build the actor message model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/actor/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import { compactText, renderOutputLengthGuide, scalePromptLimit } from "@/backend/core/prompts/prompt"
import { actorActionSummary, targetSelectionSummary } from "./context"
import { normalizePromptLanguage } from "@/backend/core/prompts/language"
import type { ActorPromptBuilder } from "./contracts"

export const message: ActorPromptBuilder = (state, partial) =>
    `Actor message. Return one short spoken line as the actor below, or None if this actor does not speak.
${textGuide(state.scenario.language)}
${renderOutputLengthGuide(state.scenario.controls, "actor message")}
If Action is no_action, return None.
Natural-language output must use actor names and action labels, not internal ids.
No explanation or JSON.

${renderPromptBlock("ACTOR", { name: state.actor.name })}

${renderPromptBlock("SIMULATION", `Round: ${state.event.title}. ${compactText(state.event.summary, scalePromptLimit(300, state.scenario.controls))}`)}

${renderPromptBlock("PREVIOUS_RESULT", `Thought: ${compactText(partial.thought, scalePromptLimit(300, state.scenario.controls))}
Target: ${targetSelectionSummary(state, partial.target)}
Action: ${actorActionSummary(state, partial.action)}
Intent: ${compactText(partial.intent, scalePromptLimit(240, state.scenario.controls))}`)}`

function textGuide(language: string | undefined): string {
  const korean = normalizePromptLanguage(language) === "ko"
  const instruction = korean ? "생각과 의도는 배경 정보입니다. 현재 상황에서 대상에게 실제로 전달할 짧은 대사만 작성하세요. 내적 독백이나 행동 목적의 설명을 그대로 복사하지 말고, 대상에게 하는 요청·질문·답변으로 표현하세요. 솔직하게 말해도 되며 다른 뜻이나 숨은 의도를 억지로 만들지 마세요. 말하지 않는다면 None을 반환하세요." : "Thought and intent are background context. Write only a short line actually spoken to the target in this situation. Do not copy the private reflection or explanation of purpose; express a request, question, or reply to the recipient. Honest speech is valid: do not invent different meaning or hidden motives. Return None when not speaking."
  return `${instruction}\n${korean
    ? "현재 단계의 내용만 출력하세요. 생각·의도·발화를 함께 쓰거나 제목을 붙이지 마세요."
    : "Output only the current step. Do not include other steps or a heading."}`
}
