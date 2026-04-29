import type { ActorTraceStep } from "@simula/shared"
import { compactLines, compactText, renderOutputLengthGuide, scalePromptLimit } from "../../../prompt"
import { actorPromptContext } from "../../context"
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
Return exactly one allowed output.
Use an actor id when this actor should direct the action at another actor.
Use None only when the next action is clearly solitary or has no direct recipient.
No explanation, names, markdown, or punctuation.

Thought: ${compactText(partial.thought, 350)}
Allowed outputs:
${targetActors(state)
  .map((actor) => `- ${actor.id} (${actor.name}, ${actor.role})`)
  .join("\n")}
- None`,
  action: (state, partial) =>
    `Actor action.
Return exactly one allowed output.
Use an action id when this actor should act this round.
Use no_action only when holding position is the best choice.
No explanation, labels, markdown, or punctuation.

Round: ${state.roundIndex}
Target: ${partial.target}
Allowed outputs:
${state.actor.actions.map((action) => `- ${action.id} (${action.label}). ${action.expectedOutcome}`).join("\n")}
- no_action (hold position this round)`,
  intent: (state, partial) =>
    `Actor intent. Return one sentence explaining ${state.actor.name}'s choice in round ${state.roundIndex}.
${renderOutputLengthGuide(state.scenario.controls, "actor intent")}

Target: ${partial.target}
Action: ${partial.action}`,
  message: (state, partial) =>
    `Actor message. Return one short spoken line as ${state.actor.name}, or None if this actor does not speak.
${renderOutputLengthGuide(state.scenario.controls, "actor message")}
No explanation or JSON.

Thought: ${compactText(partial.thought, scalePromptLimit(300, state.scenario.controls))}
Target: ${partial.target}
Action: ${partial.action}
Intent: ${compactText(partial.intent, scalePromptLimit(240, state.scenario.controls))}`,
}

function coordinatorDirective(value: string, step: string, label: string): string {
  const aliases = [step, label, label.replace(/\s+/g, ""), `Coordinator ${step}`, `Coordinator ${label}`]
  return aliases.reduce((current, alias) => {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return current.replace(new RegExp(`^\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?${escapedAlias}(?:\\*\\*)?\\s*[:：-]\\s*`, "i"), "")
  }, value.trim())
}
