import type { ActorTraceStep } from "@/shared"
import { compactLines, compactText, renderOutputLengthGuide, scalePromptLimit } from "@/backend/core/prompts/prompt"
import { actorPromptContext } from "@/backend/core/simulation/actors/memory"
import type { ActorGraphState } from "@/backend/core/simulation/roles/actor/state"
import { normalizePromptLanguage } from "@/backend/core/prompts/language"
import { targetActors } from "@/backend/core/simulation/roles/actor/state"

export type ActorPromptBuilder = (
  state: ActorGraphState,
  partial: Partial<Record<ActorTraceStep, string>>
) => string

export type ActorPromptStep = Exclude<ActorTraceStep, "context">

export const actorPrompts: Record<ActorPromptStep, ActorPromptBuilder> = {
  thought: (state) =>
    `Actor thought. As ${state.actor.name}, return one short paragraph using only visible context and private profile.
${actorTextGuide(state, "thought")}
${renderOutputLengthGuide(state.scenario.controls, "actor thought")}

Digest: ${compactText(state.plannerDigest, scalePromptLimit(650, state.scenario.controls))}
Round ${state.roundIndex}: ${state.event.title}. ${state.event.summary}
Pre-round: ${compactText(state.roundDigest.preRound.content, scalePromptLimit(300, state.scenario.controls))}
Context:
${actorPromptContext(state.actor, state.scenario.controls)}
Profile: ${state.actor.role}; ${compactText(state.actor.backgroundHistory, scalePromptLimit(220, state.scenario.controls))}; ${compactText(state.actor.personality, scalePromptLimit(160, state.scenario.controls))}; wants ${compactText(state.actor.preference, scalePromptLimit(180, state.scenario.controls))}.
Guidance:
${compactLines([
  `Frame: ${coordinatorDirective(state.coordinatorTrace.runtimeFrame, "runtimeFrame", "Runtime Frame")}`,
  `Routing: ${coordinatorDirective(state.coordinatorTrace.actorRouting, "actorRouting", "Actor Routing")}`,
  `Policy: ${coordinatorDirective(state.coordinatorTrace.interactionPolicy, "interactionPolicy", "Interaction Policy")}`,
  `Outcome: ${coordinatorDirective(state.coordinatorTrace.outcomeDirection, "outcomeDirection", "Outcome Direction")}`,
], 4, scalePromptLimit(700, state.scenario.controls))}`,
  target: (state, partial) =>
    `Actor target.
Choose a direct target only when this actor has a realistic access path: existing relationship, shared team, formal meeting, public channel, operational chain, or clear scenario pressure.
Avoid unrealistic leaps across hierarchy, geography, or organization boundaries.
No explanation, names, markdown, or punctuation.

Actor: ${state.actor.name} (${state.actor.role}). ${compactText(state.actor.backgroundHistory, scalePromptLimit(180, state.scenario.controls))}
Thought: ${compactText(partial.thought, 350)}
Action: ${actorActionSummary(state, partial.action)}
Return exactly one allowed output from Allowed outputs.
Use an actor id when the selected action is directed at another actor.
Use None only when the selected action is no_action or solitary.
Allowed outputs:
${targetPromptOutputs(state, partial.action)}
Target context:
${targetPromptContext(state, partial.action)}`,
  action: (state, partial) =>
    `Actor action.
Return exactly one allowed output.
Use an action id when this actor should act this round.
Compare the listed usage conditions with your current goal; choose a concrete mechanism rather than repeating the first option.
Use no_action only when holding position is the best choice.
Stay within channels this actor can realistically use from their role, relationships, workplace, public position, or current event context.
Do not jump to private or semi-public contact with distant executives, officials, or field actors unless the scenario context makes that access plausible.
No explanation, labels, markdown, or punctuation.

Round: ${state.roundIndex}
Thought: ${compactText(partial.thought, scalePromptLimit(320, state.scenario.controls))}
Allowed outputs:
${actionPromptOutputs(state)}
- no_action (hold position this round)`,
  intent: (state, partial) =>
    `Actor intent. Return one sentence explaining ${state.actor.name}'s choice in round ${state.roundIndex}.
${actorTextGuide(state, "intent")}
${renderOutputLengthGuide(state.scenario.controls, "actor intent")}
Natural-language output must use actor names and action labels, not internal ids.

Round: ${state.event.title}. ${compactText(state.event.summary, scalePromptLimit(300, state.scenario.controls))}
Pre-round: ${compactText(state.roundDigest.preRound.content, scalePromptLimit(240, state.scenario.controls))}
Thought: ${compactText(partial.thought, scalePromptLimit(350, state.scenario.controls))}
Target: ${targetSelectionSummary(state, partial.target)}
Action: ${actorActionSummary(state, partial.action)}`,
  message: (state, partial) =>
    `Actor message. Return one short spoken line as ${state.actor.name}, or None if this actor does not speak.
${actorTextGuide(state, "message")}
${renderOutputLengthGuide(state.scenario.controls, "actor message")}
If Action is no_action, return None.
Natural-language output must use actor names and action labels, not internal ids.
No explanation or JSON.

Round: ${state.event.title}. ${compactText(state.event.summary, scalePromptLimit(300, state.scenario.controls))}
Thought: ${compactText(partial.thought, scalePromptLimit(300, state.scenario.controls))}
Target: ${targetSelectionSummary(state, partial.target)}
Action: ${actorActionSummary(state, partial.action)}
Intent: ${compactText(partial.intent, scalePromptLimit(240, state.scenario.controls))}`,
}

function coordinatorDirective(value: string, step: string, label: string): string {
  const aliases = [step, label, label.replace(/\s+/g, ""), `Coordinator ${step}`, `Coordinator ${label}`]
  return aliases.reduce((current, alias) => {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return current.replace(new RegExp(`^\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?${escapedAlias}(?:\\*\\*)?\\s*[:：-]\\s*`, "i"), "")
  }, value.trim())
}

function actorActionSummary(state: ActorGraphState, actionId: string | undefined): string {
  const normalized = actionId?.trim()
  if (!normalized || normalized === "no_action") {
    return "no_action"
  }
  const action = state.actor.actions.find((item) => item.id === normalized)
  return action ? `${action.id} (${action.visibility}, ${action.label})` : normalized
}

function targetSelectionSummary(state: ActorGraphState, targetId: string | undefined): string {
  const normalized = targetId?.trim()
  if (!normalized || normalized === "None" || normalized === "none") {
    return "None"
  }
  const target = state.actors.find((actor) => actor.id === normalized)
  return target ? `${target.id} (${target.name}, ${target.role})` : normalized
}

function actionPromptOutputs(state: ActorGraphState): string {
  const actions =
    targetActors(state).length === 0
      ? state.actor.actions.filter((action) => action.visibility === "solitary")
      : state.actor.actions
  return actions.map((action) => `- ${action.id} (${action.label}). Use when: ${action.intentHint} Effect: ${action.expectedOutcome}`).join("\n")
}

function targetPromptOutputs(state: ActorGraphState, actionId: string | undefined): string {
  const normalized = actionId?.trim()
  const action = state.actor.actions.find((item) => item.id === normalized)
  if (!normalized || normalized === "no_action" || !action || action.visibility === "solitary") {
    return "- None"
  }
  return targetActors(state).map((actor) => `- ${actor.id}`).join("\n")
}

function targetPromptContext(state: ActorGraphState, actionId: string | undefined): string {
  const normalized = actionId?.trim()
  const action = state.actor.actions.find((item) => item.id === normalized)
  if (!normalized || normalized === "no_action" || !action || action.visibility === "solitary") {
    return "- None"
  }
  return targetActors(state)
    .map((actor) => `${actor.id}: ${actor.name} (${actor.role}). ${compactText(actor.backgroundHistory, scalePromptLimit(150, state.scenario.controls))}`)
    .join("\n")
}

function actorTextGuide(state: ActorGraphState, step: "thought" | "intent" | "message"): string {
  const korean = normalizePromptLanguage(state.scenario.language) === "ko"
  const instructions = korean ? {
    thought: "현재 인물이 상황을 어떻게 해석하고 무엇을 원하거나 걱정하는지 짧은 내적 독백으로 작성하세요. 상대에게 직접 말하는 대사는 쓰지 마세요. 모르는 사실이나 숨은 동기를 지어내지 마세요.",
    intent: "앞선 생각과 현재 상황을 바탕으로, 선택한 행동으로 이번에 이루려는 목적 하나를 한 문장으로 작성하세요. 생각을 요약하거나 상대에게 할 대사를 쓰지 마세요.",
    message: "생각과 의도는 배경 정보입니다. 현재 상황에서 대상에게 실제로 전달할 짧은 대사만 작성하세요. 내적 독백이나 행동 목적의 설명을 그대로 복사하지 말고, 대상에게 하는 요청·질문·답변으로 표현하세요. 솔직하게 말해도 되며 다른 뜻이나 숨은 의도를 억지로 만들지 마세요. 말하지 않는다면 None을 반환하세요.",
  } : {
    thought: "Write a short private reflection: how this actor interprets the situation and what they want or worry about. Do not address another actor with spoken dialogue. Do not invent unknown facts or hidden motives.",
    intent: "Using the preceding thought and current situation, state one purpose of the selected action this turn in one sentence. Do not summarize the thought or write dialogue.",
    message: "Thought and intent are background context. Write only a short line actually spoken to the target in this situation. Do not copy the private reflection or explanation of purpose; express a request, question, or reply to the recipient. Honest speech is valid: do not invent different meaning or hidden motives. Return None when not speaking.",
  }
  const example = korean
    ? "역할 구분 예시(내용은 복사하지 말고 현재 인물과 상황에 맞추세요): 생각: 거절하면 관계가 어색해질까 걱정된다. / 의도: 관계를 유지하면서 답변할 시간을 확보한다. / 발화: 조금 더 생각하고 내일 답해도 될까?\n현재 단계의 내용만 출력하세요. 제목이나 다른 단계의 내용은 제외하세요."
    : "Role example (do not copy its content; adapt to this actor and situation): Thought: I worry that refusing will strain our relationship. / Intent: Preserve the relationship while gaining time to respond. / Message: Could I think it over and answer tomorrow?\nOutput only the current step, without headings or other steps."
  return `${instructions[step]}\n${example}`
}
