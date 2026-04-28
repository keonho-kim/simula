import type { RunEvent } from "@simula/shared"
import { actorPrompts, type ActorPromptStep } from "./prompts"
import { runActorTextNode } from "./node"
import {
  applyActorTraceStep,
  buildActorDecision,
  isValidActorAction,
  isValidActorTarget,
  targetActors,
  type ActorGraphState,
} from "./state"

export function createActorStepNode(
  step: ActorPromptStep,
  emit: (event: RunEvent) => Promise<void>
): (state: ActorGraphState) => Promise<Partial<ActorGraphState>> {
  return async (state) => {
    const partial = {
      thought: state.trace.thought,
      target: state.trace.target,
      action: state.trace.action,
      intent: state.trace.intent,
      message: state.trace.message,
    }
    const validate =
      step === "target" ? isValidActorTarget : step === "action" ? isValidActorAction : undefined
    const result = await runActorTextNode(state, step, actorPrompts[step], partial, emit, validate, actorAllowedOutputs(step))
    return {
      trace: applyActorTraceStep(state.trace, step, result.text, result.retries),
    }
  }
}

export async function actorNode(state: ActorGraphState): Promise<Partial<ActorGraphState>> {
  return {
    decision: buildActorDecision(state),
  }
}

function actorAllowedOutputs(
  step: ActorPromptStep
): ((state: ActorGraphState) => string[]) | undefined {
  if (step === "target") {
    return (state) => [...targetActors(state).map((actor) => actor.id), "None"]
  }
  if (step === "action") {
    return (state) => [...state.actor.actions.map((action) => action.id), "no_action"]
  }
  return undefined
}
