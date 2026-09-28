/**
 * Purpose: Request a concrete solitary action record without dialogue or invented recipients.
 * Pattern: Pure prompt builder.
 * Usage: Selected by the actor message builder for solitary actions.
 * Related: src/backend/core/simulation/roles/actor/prompts/message.ts, src/backend/core/simulation/roles/actor/state.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import { compactText, scalePromptLimit } from "@/backend/core/prompts/prompt"
import { normalizePromptLanguage } from "@/backend/core/prompts/language"
import type { ActorPromptBuilder } from "./contracts"

export const solitaryAction: ActorPromptBuilder = (state, partial) => {
  const action = state.actor.actions.find(candidate => candidate.id === partial.action)
  const korean = normalizePromptLanguage(state.scenario.language) === "ko"
  return `Actor solitary action. Return one short sentence of action description, not spoken dialogue. No JSON or headings.
${korean
    ? "혼자 하는 행동입니다. 상대도 청자도 없습니다. 현재 인물이 실제로 한 정리·비교·감정 조절·계획 행동 하나를 짧게 기록하세요. 주어는 생략하고 행동으로 끝내세요. 예: ‘확인된 사실과 미확인 사항을 메모에 나누어 적는다.’ 자기 이름을 부르거나 누군가에게 요청·질문·답변하지 마세요. 생각·목적을 그대로 반복하지 말고 그것을 위해 한 일을 쓰세요. 외부 반응, 새 정보, 목표 달성을 지어내지 마세요. 침묵은 정상이나 행동 기록은 필요하므로 None을 쓰지 마세요."
    : "This is an action taken alone. There is no recipient or listener. Briefly record one concrete review, comparison, emotional regulation, or planning action performed by the actor. Use an action sentence, e.g. ‘Separates confirmed facts from open questions in a note.’ Do not address anyone, ask questions, write dialogue, or address yourself by name. Describe what was done, not a copy of the thought or purpose. Do not invent external reactions, new facts, or successful outcomes. Silence is normal, but an action record is required: do not return None."}

${renderPromptBlock("ACTOR", { name: state.actor.name })}

${renderPromptBlock("SIMULATION", compactText(state.event.summary, scalePromptLimit(300, state.scenario.controls)))}

${renderPromptBlock("CONSTRAINTS", { label: action?.label, scope: "solitary", recipient: "None" })}

${renderPromptBlock("PREVIOUS_RESULT", {
    thought: compactText(partial.thought, scalePromptLimit(300, state.scenario.controls)),
    intent: compactText(partial.intent, scalePromptLimit(240, state.scenario.controls)),
  })}`
}
