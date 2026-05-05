import type { ActorTraceStep } from "@simula/shared"
import { compactLines, compactText, renderOutputLengthGuide, scalePromptLimit } from "../../../prompt"
import { actorPromptContext } from "../../actor-memory"
import type { ActorGraphState } from "./state"
import { targetActors } from "./state"

export type ActorPromptBuilder = (
  state: ActorGraphState,
  partial: Partial<Record<ActorTraceStep, string>>
) => string

export type ActorPromptStep = Exclude<ActorTraceStep, "context">

export const actorPrompts: Record<ActorPromptStep, ActorPromptBuilder> = {
  thought: (state) =>
    `Actor thought. As ${state.actor.name}, return one short paragraph using only visible context and private profile.
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
${renderOutputLengthGuide(state.scenario.controls, "actor intent")}
Natural-language output must use actor names and action labels, not internal ids.

Target: ${targetSelectionSummary(state, partial.target)}
Action: ${actorActionSummary(state, partial.action)}`,
  message: (state, partial) =>
    `Actor message. Return one short spoken line as ${state.actor.name}, or None if this actor does not speak.
${renderOutputLengthGuide(state.scenario.controls, "actor message")}
If Action is no_action, return None.
Natural-language output must use actor names and action labels, not internal ids.
No explanation or JSON.

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
  return actions.map((action) => `- ${action.id} (${action.label}). ${action.expectedOutcome}`).join("\n")
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
