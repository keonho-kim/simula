import type { ActionCatalog, ActionVisibility, PromptLanguage } from "@/shared"

const scopes = {
  public: "모두에게 공개되는 행동", "semi-public": "제한된 그룹에 공개되는 행동",
  private: "상대방 한 명과의 비공개 행동", solitary: "상대방 없이 혼자 하는 행동",
}

export function actionCatalogPrompt(context: string, visibility: ActionVisibility, index: number, existing: ActionCatalog, language: PromptLanguage, errors: string[]): string {
  const accepted = Object.values(existing).map(action => ({ code: action.id, scope: action.visibility, label: action.label, intent: action.intentHint }))
  const instruction = language === "ko" ? `시나리오에서 실제로 가능한 행동 하나만 만드세요.
공개 범위: ${scopes[visibility]}. 이 범위의 ${index + 1}번째 행동입니다.
출력은 JSON 객체 하나입니다. 키는 label, intentHint, expectedOutcome만 사용하세요.
세 필드의 값은 모두 한국어로 작성하세요. 영어 설명, 배열, 코드 블록, JSON 밖의 문장은 금지합니다.
label은 40자 이내의 구체적인 행동 이름입니다.
intentHint는 언제/왜 사용하는지, expectedOutcome은 시도하는 효과를 각각 200자 이내 한 문장으로 설명합니다.
참여자가 실행할 수 있는 행동이어야 하며, 성공을 보장하지 마세요. 인물 이름을 고정하지 마세요.
기존 행동과 목적이 다른 행동을 만드세요. 같은 이름의 띄어쓰기·번호 변경이나 동의어 치환은 금지합니다.
정보 확인, 의사 전달, 경계 설정, 협상, 지원, 관계 회복 중 시나리오에 적합하고 아직 부족한 목적을 선택하세요.
형식 예시(내용은 복사하지 마세요): {"label":"답변 시점 협의","intentHint":"당장 답하기 어려울 때","expectedOutcome":"서로 기다릴 수 있는 시간을 합의하려 한다"}` : `Create exactly one concrete, reusable action for this scenario.
Visibility: ${visibility}; action number ${index + 1} within this scope.
Return one JSON object with exactly label, intentHint, expectedOutcome. All values must be English.
No arrays, codes, markdown fences, commentary, or text outside JSON.
label: a concrete name up to 40 characters. intentHint: when/why to use it. expectedOutcome: attempted effect.
Condition and effect must each be one sentence up to 200 characters. Do not guarantee success or hardcode actor names.
Use participants' actual authority. Choose an underrepresented purpose: information gathering, disclosure, boundaries, negotiation, support, or reconciliation.
Do not repeat existing purposes through synonyms, spelling changes, or numbered variants.
Shape example (do not copy its content): {"label":"Agree on response timing","intentHint":"When an immediate answer is difficult","expectedOutcome":"Seek a mutually acceptable time to respond"}`
  return `Planner actionCatalog.
Scope: ${visibility}
${instruction}

Scenario and planner context:
${context}

Accepted actions (keep unchanged; do not repeat):
${JSON.stringify(accepted)}
${errors.length ? `\nValidation feedback for this action only:\n${errors.join("\n")}\n${language === "ko" ? "위 오류를 고친 새 JSON 객체 하나만 반환하세요. 기존 확정 행동은 재생성하지 마세요." : "Return one corrected JSON object for this action only. Do not regenerate accepted actions."}` : ""}`
}
