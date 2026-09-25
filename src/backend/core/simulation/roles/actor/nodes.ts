/**
 * Purpose: Apply one actor decision step using external context and model settings.
 * Pattern: Workflow node factory.
 * Usage: Bound to per-turn dependencies by the actor graph constructor.
 * Related: src/backend/core/simulation/roles/actor/graph.ts, src/backend/core/simulation/roles/actor/node.ts
 */
import type { LLMSettings, RunEvent } from "@/shared"
import { actorPrompts, type ActorPromptStep } from "@/backend/core/simulation/roles/actor/prompts"
import { runActorTextNode } from "@/backend/core/simulation/roles/actor/node"
import {
  applyActorTraceStep,
  actionAllowedOutputs,
  buildActorDecision,
  isValidActorAction,
  isValidActorTarget,
  normalizeActorAction,
  targetAllowedOutputs,
  type ActorGraphState,
  type ActorStepInput,
} from "@/backend/core/simulation/roles/actor/state"

import type { ActorContext } from "./context"

export function createActorStepNode(
  step: ActorPromptStep,
  context: ActorContext,
  settings: LLMSettings,
  emit: (event: RunEvent) => Promise<void>
): (state: ActorGraphState) => Promise<Partial<ActorGraphState>> {
  return async (graphState) => {
    const state: ActorStepInput = { ...context, ...graphState }
    const selectedAction = normalizeActorAction(state.trace.action, state)
    if (step === "target" && (!selectedAction || selectedAction === "no_action")) {
      return {
        trace: applyActorTraceStep(state.trace, step, "None", 0),
      }
    }
    if (step === "message" && (!selectedAction || selectedAction === "no_action")) {
      return {
        trace: applyActorTraceStep(state.trace, step, "None", 0),
      }
    }

    const partial = {
      thought: state.trace.thought,
      target: state.trace.target,
      action: state.trace.action,
      intent: state.trace.intent,
      message: state.trace.message,
    }
    const validate =
      step === "target" ? isValidActorTarget : step === "action" ? isValidActorAction : undefined
    const result = await runActorTextNode(state, settings, step, actorPrompts[step], partial, emit, validate, actorAllowedOutputs(step))
    return {
      trace: applyActorTraceStep(state.trace, step, result.text, result.retries),
    }
  }
}

export async function actorNode(state: ActorStepInput): Promise<Partial<ActorGraphState>> {
  return {
    decision: buildActorDecision(state),
  }
}

function actorAllowedOutputs(
  step: ActorPromptStep
): ((state: ActorStepInput) => string[]) | undefined {
  if (step === "target") {
    return targetAllowedOutputs
  }
  if (step === "action") {
    return actionAllowedOutputs
  }
  return undefined
}
