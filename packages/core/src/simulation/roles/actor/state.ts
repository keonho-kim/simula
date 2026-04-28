import type {
  ActorDecision,
  ActorTraceStep,
  ActorState,
  CoordinatorTrace,
  LLMSettings,
  PlannedEvent,
  RoundDigest,
  ScenarioInput,
} from "@simula/shared"
import { contextUsedByActor } from "../../context"

export interface ActorTrace {
  thought: string
  target: string
  action: string
  intent: string
  message: string
  retryCounts: Record<ActorTraceStep, number>
}

export interface ActorGraphState {
  runId: string
  scenario: ScenarioInput
  plannerDigest: string
  settings: LLMSettings
  actor: ActorState
  actors: ActorState[]
  event: PlannedEvent
  roundDigest: RoundDigest
  roundIndex: number
  coordinatorTrace: CoordinatorTrace
  trace: ActorTrace
  decision?: ActorDecision
}

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

export function buildActorDecision(state: ActorGraphState): ActorDecision {
  const selectedAction = normalizeActorAction(state.trace.action, state)
  const selectedTarget = normalizeActorTarget(state.trace.target, state)
  const message = normalizeActorMessage(state.trace.message)
  if (!selectedAction || selectedAction === "no_action") {
    return {
      actorId: state.actor.id,
      decisionType: "no_action",
      visibility: "solitary",
      targetActorIds: [],
      intent: state.trace.intent,
      message,
      expectation: `Hold position while considering ${state.coordinatorTrace.outcomeDirection.toLowerCase()}.`,
      contextUsed: contextUsedByActor(state.actor),
    }
  }

  const action = state.actor.actions.find((item) => item.id === selectedAction)
  if (!action) {
    throw new Error(`actor.${state.actor.id} selected an unknown action.`)
  }
  const targetActorIds =
    action.visibility === "solitary" || selectedTarget === "none" || !selectedTarget ? [] : [selectedTarget]
  return {
    actorId: state.actor.id,
    actionId: action.id,
    decisionType: "action",
    visibility: action.visibility,
    targetActorIds,
    intent: state.trace.intent,
    message,
    expectation: action.expectedOutcome,
    contextUsed: contextUsedByActor(state.actor),
  }
}

export function normalizeActorTarget(value: string, state: ActorGraphState): string | undefined {
  const normalized = value.trim()
  if (normalized === "None") {
    return "none"
  }
  const candidates = targetActors(state)
  return candidates.find((actor) => actor.id === normalized)?.id
}

export function normalizeActorAction(value: string, state: ActorGraphState): string | undefined {
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

export function isValidActorTarget(value: string, state: ActorGraphState): boolean {
  return Boolean(normalizeActorTarget(value, state))
}

export function isValidActorAction(value: string, state: ActorGraphState): boolean {
  return Boolean(normalizeActorAction(value, state))
}

export function targetActors(state: ActorGraphState): ActorState[] {
  return state.actors.filter((actor) => actor.id !== state.actor.id)
}

function compact(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replaceAll(/\s+/g, " ")
}
