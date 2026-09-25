/**
 * Purpose: Return deterministic shared-builder outputs for local browser tests.
 * Pattern: Test-only provider fixture.
 * Usage: Called only after SIMULA_TEST_MODEL and the dedicated test key are checked.
 * Related: src/backend/integrations/llm/model-factory.ts, apps/web/e2e/document-scenario.e2e.ts
 */
import { testPromptInput } from "./prompt-input"

export function testScenarioBuilderResponse(prompt: string): string | undefined {
  if (prompt.includes("Task ID: situation-") && prompt.includes("Allowed answer: one short sentence")) {
    const korean = prompt.includes("Write Korean prose.")
    if (prompt.includes("Task ID: situation-title")) return korean ? "투자 검토" : "Investment review"
    if (prompt.includes("Task ID: situation-purpose")) return korean ? "제안의 조건을 검토한다." : "Evaluate the proposal."
    if (prompt.includes("Task ID: situation-decision")) return korean ? "진행 또는 보완을 결정한다." : "Proceed or request changes."
    if (prompt.includes("Task ID: situation-setting")) return korean ? "예산 검토 회의실에서 시작한다." : "Budget review meeting."
  }
  const participantField = prompt.match(/Task ID: participant-\d+-(personality|authority|goal)/)?.[1]
  if (participantField && prompt.includes("Allowed answer: one short sentence")) {
    const korean = prompt.includes("Write Korean prose.")
    return {
      personality: korean ? "근거를 확인하고 불확실한 점을 질문합니다." : "Checks evidence and asks about uncertainty.",
      authority: korean ? "담당 분야에 대한 검토 의견을 제시합니다." : "Advises on the decision within their responsibility.",
      goal: korean ? "실행 가능한 결정 조건을 찾습니다." : "Find feasible conditions for a decision.",
    }[participantField]
  }
  if (prompt.includes("Task ID: roster-count")) return "2"
  if (prompt.includes("Task ID: roster-name-")) {
    const korean = prompt.includes("Write Korean prose.")
    return prompt.includes("Task ID: roster-name-1") ? korean ? "기술 담당자" : "Technical lead"
      : korean ? "재무 담당자" : "Finance representative"
  }
  if (prompt.includes("Allowed answer: one concise scenario assumption") && prompt.includes("Task ID: facet-")) {
    return prompt.includes("Write Korean prose.") ? "투자안의 실행 조건을 검토합니다." : "Review the proposal against the budget and launch conditions."
  }
  if (prompt.includes("Allowed answer: one concise rule sentence") && prompt.includes("Task ID: rule-")) {
    if (!prompt.includes("Task ID: rule-information")) return prompt.includes("Write Korean prose.")
      ? "결정과 남은 검토 조건을 기록합니다." : "Record the decision and remaining review conditions."
    const participants = testPromptInput(prompt).participants
    const last = Array.isArray(participants) ? participants.at(-1) : undefined
    const name = last && typeof last === "object" && "name" in last ? String(last.name) : "the designated participant"
    return prompt.includes("Write Korean prose.")
      ? `${name}만 처음부터 자료 사실을 알고, 다른 참가자는 수락된 전달 후에 알게 됩니다.`
      : `Only ${name} initially knows the source facts; others learn through accepted disclosure.`
  }
  if (prompt.includes("Allowed answer: one short sentence") && (prompt.includes("Task ID: agenda") || prompt.includes("Task ID: information"))) {
    return prompt.includes("Task ID: information") ? "Share only information known to each participant." : "Review the proposal before deciding."
  }
  if (prompt.includes("Task ID: source-access-fact-")) {
    const input = testPromptInput(prompt)
    return Array.isArray(input.participants) && input.participants.length ? String(input.participants.length) : "?"
  }
  if (prompt.includes("Task ID: opening-setting")) return prompt.includes("Write Korean prose.")
    ? "예산 검토 회의실에서 시작합니다." : "The review begins in a meeting room."
  if (prompt.includes("Task ID: opening-summary")) return prompt.includes("Write Korean prose.")
    ? "참가자들이 투자 제안을 검토합니다." : "Participants begin reviewing the proposal."
  if (prompt.includes("Task ID: opening-assumption")) return "0"
  if (/Task ID: actor-participant-\d+-summary/.test(prompt)) return prompt.includes("Write Korean prose.")
    ? "공개된 근거를 검토하자고 제안합니다." : "Asks to review the public evidence."
  if (/Task ID: concern-participant-\d+-goal/.test(prompt)) return prompt.includes("Write Korean prose.")
    ? "잘못된 결정이 담당 영역에 부담을 줄까 우려합니다." : "Worries that a premature decision may harm their responsibility."
  const evidenceTaskId = prompt.match(/^Task ID: (\S+)/m)?.[1]
  if (evidenceTaskId?.includes("-claim-")) return prompt.includes("Write Korean prose.")
    ? "자료에는 검토할 제안이 기록되어 있습니다." : "The material describes a proposal under review."
  if (evidenceTaskId?.endsWith("-summary")) return prompt.includes("Write Korean prose.")
    ? "자료의 제안과 결정 조건을 검토합니다." : "The proposal and decision conditions require review."
  if (evidenceTaskId?.endsWith("-gap")) return "0"
  if (evidenceTaskId?.endsWith("-select")) {
    const choices = testPromptInput(prompt).choices
    return Array.isArray(choices) ? choices.slice(0, 4).map((_, index) => index + 1).join(",") : "1"
  }
  return undefined
}
