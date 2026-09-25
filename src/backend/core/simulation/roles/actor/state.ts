/**
 * Purpose: Own actor graph decision state and deterministic choice normalization.
 * Pattern: Graph state and pure decision transformations.
 * Usage: Used by actor graph nodes with a separate per-turn context projection.
 * Related: src/backend/core/simulation/roles/actor/context.ts, src/backend/core/simulation/roles/actor/graph.ts
 */
import { Annotation } from "@langchain/langgraph"
import type { ActorDecision, ActorTraceStep } from "@/shared"
import type { ActorContext, ActorPublicContext } from "./context"
import { sanitizeActorVisibleText } from "@/backend/core/simulation/actors/visible-text"

export interface ActorTrace {
  thought: string
  target: string
  action: string
  intent: string
  message: string
  retryCounts: Record<ActorTraceStep, number>
}

export interface ActorGraphState {
  trace: ActorTrace
  decision?: ActorDecision
}
export type ActorStepInput = ActorContext & ActorGraphState

export function initialActorTrace(): ActorTrace {
  return {
    thought: "",
    target: "",
    action: "",
    intent: "",
    message: "",
    retryCounts: {
      thought: 0,
      target: 0,
      action: 0,
      intent: 0,
      message: 0,
      context: 0,
    },
  }
}

export function applyActorTraceStep(
  trace: ActorTrace,
  step: ActorTraceStep,
  text: string,
  retries: number
): ActorTrace {
  return {
    ...trace,
    [step]: text,
    retryCounts: {
      ...trace.retryCounts,
      [step]: retries,
    },
  }
}

export function buildActorDecision(state: ActorStepInput): ActorDecision {
  const selectedAction = normalizeActorAction(state.trace.action, state)
  const intent = sanitizeActorVisibleText(state.trace.intent, state.actors)
  const thought = sanitizeActorVisibleText(state.trace.thought, state.actors)
  if (!selectedAction || selectedAction === "no_action") {
    return {
      actorId: state.actor.id,
      thought,
      decisionType: "no_action",
      visibility: "solitary",
      targetActorIds: [],
      intent,
      expectation: sanitizeActorVisibleText(
        `Hold position while considering ${state.coordinatorTrace.outcomeDirection.toLowerCase()}.`,
        state.actors
      ),
      contextUsed: state.contextUsed,
    }
  }

  const action = state.actor.actions.find((item) => item.id === selectedAction)
  if (!action) {
    throw new Error(`actor.${state.actor.id} selected an unknown action.`)
  }
  const selectedTarget = normalizeActorTarget(state.trace.target, state)
  if (action.visibility !== "solitary" && (!selectedTarget || selectedTarget === "none")) {
    throw new Error(`actor.${state.actor.id} selected ${action.id} without a target.`)
  }
  const message = normalizeActorMessage(sanitizeActorVisibleText(state.trace.message, state.actors))
  const targetActorIds =
    action.visibility === "solitary" || selectedTarget === "none" || !selectedTarget ? [] : [selectedTarget]
  return {
    actorId: state.actor.id,
    thought,
    actionId: action.id,
    decisionType: "action",
    visibility: action.visibility,
    targetActorIds,
    intent,
    message,
    expectation: sanitizeActorVisibleText(action.expectedOutcome, state.actors),
    contextUsed: state.contextUsed,
  }
}

export function normalizeActorTarget(value: string, state: ActorStepInput): string | undefined {
  const normalized = value.trim()
  if (normalized === "None") {
    return "none"
  }
  const candidates = targetActors(state)
  return candidates.find((actor) => actor.id === normalized)?.id
}

export function normalizeActorAction(value: string, state: ActorStepInput): string | undefined {
  const normalized = value.trim()
  if (normalized === "no_action") {
    return "no_action"
  }
  return state.actor.actions.find((action) => action.id === normalized)?.id
}

export function normalizeActorMessage(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed || ["none", "null", "no message", "silent"].includes(compact(trimmed))) {
    return undefined
  }
  return trimmed
}

export function isValidActorTarget(value: string, state: ActorStepInput): boolean {
  return targetAllowedOutputs(state).includes(value.trim())
}

export function isValidActorAction(value: string, state: ActorStepInput): boolean {
  return actionAllowedOutputs(state).includes(value.trim())
}

export function actionAllowedOutputs(state: ActorStepInput): string[] {
  const actions =
    targetActors(state).length === 0
      ? state.actor.actions.filter((action) => action.visibility === "solitary")
      : state.actor.actions
  return [...actions.map((action) => action.id), "no_action"]
}

export function targetAllowedOutputs(state: ActorStepInput): string[] {
  const selectedAction = normalizeActorAction(state.trace.action, state)
  if (!selectedAction || selectedAction === "no_action") {
    return ["None"]
  }

  const action = state.actor.actions.find((item) => item.id === selectedAction)
  if (!action || action.visibility === "solitary") {
    return ["None"]
  }

  return targetActors(state).map((actor) => actor.id)
}

export function targetActors(state: ActorStepInput): ActorPublicContext[] {
  return state.actors.filter((actor) => actor.id !== state.actor.id)
}

function compact(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replaceAll(/\s+/g, " ")
}

export const ActorAnnotation = Annotation.Root({
  trace: Annotation<ActorTrace>(),
  decision: Annotation<ActorDecision | undefined>(),
})

export function createActorGraphState(): ActorGraphState {
  return { trace: initialActorTrace() }
}
