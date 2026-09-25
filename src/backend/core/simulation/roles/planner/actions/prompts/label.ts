/**
 * Purpose: Request one distinct action name for a Planner visibility scope.
 * Pattern: Prompt definition.
 * Usage: Called by the Planner action-catalog node before intent and outcome.
 * Related: src/backend/core/simulation/roles/planner/actions/node.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import type { ActionCatalog, ActionVisibility, PromptLanguage } from "@/shared"

export function actionLabelPrompt(context: string, visibility: ActionVisibility, index: number,
  existing: ActionCatalog, language: PromptLanguage, errors: string[]): string {
  const accepted = Object.values(existing).map(action => ({ scope: action.visibility, label: action.label, intent: action.intentHint }))
  const solitary = visibility === "solitary"
  const instruction = language === "ko"
    ? `현재 시나리오에서 실행 가능한 ${index + 1}번째 ${visibility} 행동의 이름만 작성하세요. 40자 이내의 짧은 한국어 명사구 하나만 반환하고 JSON, 코드, 설명은 쓰지 마세요. 기존 행동과 다른 목적을 선택하세요. 띄어쓰기·번호·동의어만 바꾼 이름은 중복입니다. ${solitary ? "혼자 하는 정보 정리, 선택 비교, 감정 조절, 계획 수립에서 고르세요. 질문이나 대화는 제외합니다." : "정보 확인, 의사 전달, 경계 설정, 협상, 지원, 관계 회복 중 상황에 맞는 행동을 고르세요."}`
    : `Write only the name of the ${index + 1}th ${visibility} action available in this scenario. Return one short English noun phrase, at most 40 characters; no JSON, code, or explanation. Choose a purpose different from accepted actions, not a spelling or numbering variant. ${solitary ? "Choose solitary information review, option comparison, emotional regulation, or planning; no dialogue." : "Consider information gathering, disclosure, boundaries, negotiation, support, or reconciliation."}`
  return `Planner actionCatalog.\nField: label\nScope: ${visibility}\n${instruction}\n\n${renderPromptBlock("SCENARIO", context)}\n\n${renderPromptBlock("PREVIOUS_RESULT", { accepted })}${errors.length ? `\n${renderPromptBlock("FEEDBACK", errors)}` : ""}`
}
