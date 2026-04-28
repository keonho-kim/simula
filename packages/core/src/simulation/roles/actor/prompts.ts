import type { ActorTraceStep } from "@simula/shared"
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
    `Actor thought. In one short paragraph, judge the situation only as ${state.actor.name}.
Use only the information this actor is allowed to know: public context, their own memory, their private profile, and coordinator guidance.
Do not use hidden information from other actors unless it is already in this actor's memory or visible context.

Scenario: ${state.scenario.text}
Planner scenario digest:
${state.plannerDigest}
Round ${state.roundIndex}: ${state.event.title}. ${state.event.summary}
Pre-round: ${state.roundDigest.preRound.content}
Visible context:
${actorPromptContext(state.actor)}
Actor role: ${state.actor.role}
Actor background history: ${state.actor.backgroundHistory}
Actor personality: ${state.actor.personality}
Actor preference: ${state.actor.preference}
Actor goal: ${state.actor.privateGoal}
Runtime directive: ${coordinatorDirective(state.coordinatorTrace.runtimeFrame, "runtimeFrame", "Runtime Frame")}
Routing directive: ${coordinatorDirective(state.coordinatorTrace.actorRouting, "actorRouting", "Actor Routing")}
Interaction policy: ${coordinatorDirective(state.coordinatorTrace.interactionPolicy, "interactionPolicy", "Interaction Policy")}
Outcome direction: ${coordinatorDirective(state.coordinatorTrace.outcomeDirection, "outcomeDirection", "Outcome Direction")}`,
  target: (state, partial) =>
    `Actor target.
Return exactly one allowed output.
Use an actor id when this actor should direct the action at another actor.
Use None only when the next action is clearly solitary or has no direct recipient.
Do not explain. Do not use actor names. Do not use Markdown. Do not add punctuation.

Thought: ${partial.thought}
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
Do not explain. Do not use action labels. Do not use Markdown. Do not add punctuation.

Round: ${state.roundIndex}
Target: ${partial.target}
Allowed outputs:
${state.actor.actions.map((action) => `- ${action.id} (${action.label}). ${action.expectedOutcome}`).join("\n")}
- no_action (hold position this round)`,
  intent: (state, partial) =>
    `Actor intent. In one sentence, explain why ${state.actor.name} chose this action for round ${state.roundIndex}.

Target: ${partial.target}
Action: ${partial.action}`,
  message: (state, partial) =>
    `Actor message. Return one short spoken line as ${state.actor.name}, or None if this actor does not speak.
Do not explain the message. Do not wrap it in JSON.

Thought: ${partial.thought}
Target: ${partial.target}
Action: ${partial.action}
Intent: ${partial.intent}`,
}

function coordinatorDirective(value: string, step: string, label: string): string {
  const aliases = [step, label, label.replace(/\s+/g, ""), `Coordinator ${step}`, `Coordinator ${label}`]
  return aliases.reduce((current, alias) => {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return current.replace(new RegExp(`^\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?${escapedAlias}(?:\\*\\*)?\\s*[:：-]\\s*`, "i"), "")
  }, value.trim())
}
