/**
 * Purpose: Judge autonomous continuation from changed evidence and a concrete remaining step.
 * Pattern: Bilingual prompt builder with an exact-choice contract.
 * Usage: Coordinator calls this after each completed actor round.
 * Related: src/backend/core/simulation/roles/coordinator/progress.ts, src/backend/core/simulation/roles/coordinator/nodes.ts
 */
import { renderPromptBlocks } from "@/backend/core/prompts/blocks"
import type { PromptLanguage } from "@/shared"

const ENGLISH = `You decide whether ONE more round is justified, not whether the current round was interesting.
Return 1 only when BOTH conditions hold:
A. Compared with PREVIOUS_STATE, CURRENT_STATE contains a relevant change supported by recorded actions.
B. That change leaves a specific, feasible next response or action for an existing participant within the scenario.
Return 0 if either condition is absent, or the scenario's end condition has been reached.

Apply these checks in order:
1. Identify the scenario's decision and end condition. Compare the same actors and events across the two states. In round 1, the baseline is the initial situation with no prior actions.
2. Look for a new fact, a first actionable proposal, an explicit acceptance/refusal, a changed constraint, or an executed action. A fresh proposal awaiting a recipient's answer can justify another round; agreement is not required yet.
3. Separate speech from consequences. An intention, expectation, memory paraphrase, event status label, or relationship score is not proof of execution. A refusal can create progress if it changes the available options.
4. Check what specifically remains possible: who can answer, decide, verify, or execute next? Ground this in the records. Do not invent another crisis, actor, or goal to keep running.
5. If the remaining work only repeats the same request, restates positions, or waits for an unsupported external event, stop. Unfinished events alone do not justify continuation. Stop after resolution even if this round contained a major change.

Examples (apply the conditions, not keyword matching):
- First concrete Friday-release proposal awaits the responsible person's response: 1.
- Friday agreed; a named owner must still verify a required safety check: 1.
- New refusal rules out Friday; a feasible Monday alternative remains to decide: 1.
- Same deadline request again, with no new facts or changed terms: 0.
- Everyone repeats their intention to investigate, with no result or feasible next step: 0.
- Terminal example: the required release decision is made, communicated, and no required follow-up remains: 0.
- Event remains marked partial but the actors only repeat the same positions: 0.
Return exactly one digit: 1 or 0. No explanation, JSON, or markdown.`

const KOREAN = `현재 라운드가 흥미로웠는지가 아니라, 다음 한 라운드를 진행할 근거가 있는지 판단하세요.
다음 두 조건을 모두 만족할 때만 1을 반환하세요.
A. 이전 상태와 비교해 현재 기록된 행동에서 상황에 관련된 변화가 확인됩니다.
B. 그 변화로 인해 기존 참가자가 시나리오 범위 안에서 할 수 있는 구체적인 후속 응답이나 행동이 남아 있습니다.
어느 조건이든 없거나 시나리오의 종료 조건을 충족했다면 0을 반환하세요.

다음 순서로 확인하세요.
1. 시나리오의 핵심 결정과 종료 조건을 확인하고, 이전과 현재의 같은 인물·사건을 비교하세요. 첫 라운드는 행동이 없던 초기 상태와 비교합니다.
2. 새로운 정보, 처음 나온 실행 가능한 제안, 명시적인 수락·거절, 제약 변화, 수행한 행동을 찾으세요. 상대의 답을 기다리는 새 제안은 진행 근거가 될 수 있습니다. 아직 합의하지 않았다는 이유만으로 중단하지 마세요.
3. 발언과 그 결과를 구분하세요. 의도·기대·기억의 표현 변경·사건 상태 표기·관계 수치만으로 실행을 입증할 수 없습니다. 거절도 선택지를 바꿨다면 변화입니다.
4. 누가 다음에 응답·결정·확인·실행할 수 있는지 기록에서 확인하세요. 진행을 위해 새로운 위기·인물·목표를 만들어내지 마세요.
5. 같은 요청이나 입장만 반복하거나, 근거 없는 외부 사건을 기다릴 뿐이면 중단하세요. 미해결 사건이 있다는 사실만으로 계속하지 마세요. 이번에 큰 변화가 있었어도 종료 조건을 충족했다면 중단하세요.

예시 — 단어가 아니라 조건을 적용하세요.
- 처음으로 금요일 출시안을 구체적으로 제안했고 책임자의 응답이 남음: 1.
- 금요일 출시에는 합의했으나 담당자가 필수 안전 점검을 확인해야 함: 1.
- 새로운 거절로 금요일은 불가능해졌고 실행 가능한 월요일 대안을 결정해야 함: 1.
- 새로운 정보나 조건 없이 같은 마감일을 다시 요청함: 0.
- 조사하겠다는 의도만 반복하고 결과나 실행 가능한 후속 행동이 없음: 0.
- 종료 예시: 필요한 출시 결정을 확정·전달했고 필수 후속 행동이 남지 않음: 0.
- 사건에 partial 표시가 남아 있지만 인물들은 같은 입장만 반복함: 0.
숫자 1 또는 0 하나만 반환하세요. 설명·JSON·마크다운은 출력하지 마세요.`

export function progressPrompt(previous: string, current: string, scenario: string, language: PromptLanguage = "en"): string {
  return `Coordinator progressDecision.
${language === "ko" ? KOREAN : ENGLISH}

${renderPromptBlocks({
    SCENARIO: scenario,
    PREVIOUS_STATE: `Previous situation and actions:\n${previous}`,
    CURRENT_STATE: `Current situation and actions:\n${current}`,
  })}`
}
