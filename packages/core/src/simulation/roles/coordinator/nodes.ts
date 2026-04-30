import type {
  ActorDecision,
  ActorState,
  CoordinatorTrace,
  CoordinatorTraceStep,
  InjectedEvent,
  Interaction,
  PlannedEvent,
  RoundDigest,
  RunEvent,
  StopReason,
} from "@simula/shared"
import { invokeRoleTextWithMetrics } from "../../../llm"
import { withPromptLanguageGuide } from "../../../language"
import { scalePromptLimit } from "../../../prompt"
import {
  applyInjectedEventContext,
  applyInteractionContext,
  compressActorContext,
  resolveActorContextTokenBudget,
} from "../../actor-memory"
import {
  buildPreRoundDigest,
  continuityEvent,
  eventForInjection,
  eventInjectionAllowedOutputs,
  eventInjectionDisplayValue,
  injectedEventForRound,
  isInjectableEvent,
  selectEventInjection,
} from "../../event-injection"
import { applyActorDecision, buildInteraction } from "../../interactions"
import { plannerDigestSummary } from "../../plan"
import { summarizeEvents, summarizeInteractions } from "../../reporting"
import { upsertRoleTrace } from "../../state"
import type { WorkflowState } from "../../state"
import { createActorGraph, createActorGraphState } from "../actor"
import { repairExactChoice } from "../repair"
import type { CoordinatorPromptBuilder } from "./prompts"
import { coordinatorPrompts } from "./prompts"
import {
  coordinatorTracePartial,
  getCoordinatorTrace,
} from "./state"

const MAX_ATTEMPTS = 5

interface ActorGraphResult {
  actorId: string
  decision: ActorDecision
}

export function createCoordinatorStepNode(
  step: CoordinatorTraceStep,
  promptBuilder: CoordinatorPromptBuilder,
  emit: (event: RunEvent) => Promise<void>
): (state: WorkflowState) => Promise<Partial<WorkflowState>> {
  return async (state) => {
    const currentTrace = getCoordinatorTrace(state.simulation)
    const partial = coordinatorTracePartial(currentTrace)
    const result = await runCoordinatorTextNode(state, step, promptBuilder, partial, emit)
    const nextTrace: CoordinatorTrace = {
      ...currentTrace,
      [step]: result.text,
      retryCounts: {
        ...currentTrace.retryCounts,
        [step]: result.retries,
      },
    }

    return {
      simulation: upsertRoleTrace(state.simulation, nextTrace),
    }
  }
}

export async function coordinatorNode(
  state: WorkflowState,
  emit: (event: RunEvent) => Promise<void>,
  roundDelayMs = 0,
  waitForNextRound?: (roundIndex: number) => Promise<void>,
  isCanceled?: () => boolean
): Promise<Partial<WorkflowState>> {
  const trace = getCoordinatorTrace(state.simulation)
  const events = (state.simulation.plan?.majorEvents ?? []).map((event) => ({ ...event }))
  let actors = state.simulation.actors.map((actor) => ({ ...actor }))
  let coordinatorTrace = trace
  const interactions: Interaction[] = []
  const roundDigests: RoundDigest[] = []
  let maxRound = Math.max(1, state.scenario.controls.maxRound ?? 8)
  let stopReason: StopReason = "simulation_done"
  const contextTokenBudget = resolveActorContextTokenBudget(state.scenario, state.settings)

  for (let roundIndex = 1; roundIndex <= maxRound; roundIndex += 1) {
    throwIfCanceled(isCanceled)
    const injectionResult = await resolveEventInjection(
      workflowSnapshot(state, actors, interactions, roundDigests, events, maxRound),
      emit,
      events
    )
    coordinatorTrace = updateCoordinatorTrace(coordinatorTrace, "eventInjection", injectionResult.text, injectionResult.retries)
    const selectedEvent = eventForInjection(injectionResult.text, events)
    const event = selectedEvent ?? continuityEvent(roundIndex)
    let injectedEvent: InjectedEvent | undefined = undefined
    if (selectedEvent) {
      injectedEvent = injectedEventForRound(roundIndex, selectedEvent)
      selectedEvent.status = "active"
      await emit({
        type: "event.injected",
        runId: state.runId,
        timestamp: new Date().toISOString(),
        event: injectedEvent,
      })
      actors = applyInjectedEventContext(actors, injectedEvent)
    }

    const roundDigest = buildPreRoundDigest(roundIndex, injectedEvent)
    roundDigests.push(roundDigest)
    actors = await Promise.all(
      actors.map((actor) =>
        compressActorContext(actor, {
          runId: state.runId,
          scenario: state.scenario,
          settings: state.settings,
          roundIndex,
          tokenBudget: contextTokenBudget,
          emit,
        })
      )
    )

    const snapshot = actors
    await Promise.all(
      snapshot.map((actor) =>
        runActorGraph(state, snapshot, actor, event, roundDigest, roundIndex, coordinatorTrace, emit).then(async (result) => {
          const currentActor = actors.find((item) => item.id === result.actorId)
          if (!currentActor) {
            return
          }

          actors = applyActorDecision(actors, result.decision)
          const interaction = buildInteraction(roundIndex, event, currentActor, actors, result.decision)
          interactions.push(interaction)
          actors = applyInteractionContext(actors, interaction)

          await emit({
            type: "interaction.recorded",
            runId: state.runId,
            timestamp: new Date().toISOString(),
            interaction,
          })
          if (result.decision.message) {
            await emit({
              type: "actor.message",
              runId: state.runId,
              timestamp: new Date().toISOString(),
              actorId: currentActor.id,
              actorName: currentActor.name,
              content: result.decision.message,
            })
          }
        })
      )
    )
    throwIfCanceled(isCanceled)
    if (selectedEvent) {
      const resolutionResult = await runCoordinatorValidatedNode(
        workflowSnapshot(state, actors, interactions, roundDigests, events, maxRound),
        "eventResolution",
        coordinatorPrompts.eventResolution,
        emit,
        selectEventResolution,
        () => ["completed", "partial"]
      )
      coordinatorTrace = updateCoordinatorTrace(
        coordinatorTrace,
        "eventResolution",
        resolutionResult.text,
        resolutionResult.retries
      )
      selectedEvent.status = resolutionResult.text === "partial" ? "partial" : "completed"
    }
    await emit({
      type: "round.completed",
      runId: state.runId,
      timestamp: new Date().toISOString(),
      roundIndex,
    })

    const progressResult = await runCoordinatorValidatedNode(
      workflowSnapshot(state, actors, interactions, roundDigests, events, maxRound),
      "progressDecision",
      coordinatorPrompts.progressDecision,
      emit,
      selectProgressDecision,
      () => ["continue", "stop", "complete"]
    )
    coordinatorTrace = updateCoordinatorTrace(coordinatorTrace, "progressDecision", progressResult.text, progressResult.retries)
    throwIfCanceled(isCanceled)
    if (progressResult.text === "complete") {
      if (hasUnresolvedEvents(events)) {
        await emit({
          type: "log",
          runId: state.runId,
          timestamp: new Date().toISOString(),
          level: "info",
          message: "Coordinator requested complete, but unresolved pending or partial events remain; continuing.",
        })
      } else {
        stopReason = "simulation_done"
        break
      }
    }
    if (progressResult.text === "stop" && isNoProgressCandidate(roundIndex, interactions, roundDigests)) {
      stopReason = "no_progress"
      break
    }
    if (progressResult.text === "stop") {
      await emit({
        type: "log",
        runId: state.runId,
        timestamp: new Date().toISOString(),
        level: "info",
        message: "Coordinator requested stop, but recent activity still shows possible progress; continuing generously.",
      })
    }
    if (roundIndex === maxRound) {
      const extensionResult = await runCoordinatorValidatedNode(
        workflowSnapshot(state, actors, interactions, roundDigests, events, maxRound),
        "extensionDecision",
        coordinatorPrompts.extensionDecision,
        emit,
        selectExtensionDecision,
        () => ["continue", "stop"]
      )
      coordinatorTrace = updateCoordinatorTrace(
        coordinatorTrace,
        "extensionDecision",
        extensionResult.text,
        extensionResult.retries
      )
      if (extensionResult.text === "continue") {
        maxRound += 5
        await emit({
          type: "log",
          runId: state.runId,
          timestamp: new Date().toISOString(),
          level: "info",
          message: `Coordinator extended the simulation to ${maxRound} rounds.`,
        })
      } else {
        stopReason = isNoProgressCandidate(roundIndex, interactions, roundDigests) ? "no_progress" : "simulation_done"
        break
      }
    }
    if (roundIndex < maxRound && waitForNextRound) {
      await waitForNextRound(roundIndex)
    } else if (roundIndex < maxRound && roundDelayMs > 0) {
      await sleep(roundDelayMs)
    }
  }

  const worldSummary = `${summarizeInteractions(interactions)} ${summarizeEvents(events)}`
  await emit({
    type: "log",
    runId: state.runId,
    timestamp: new Date().toISOString(),
    level: "info",
    message: worldSummary,
  })

  return {
    simulation: {
      ...state.simulation,
      plan: state.simulation.plan ? { ...state.simulation.plan, majorEvents: events } : state.simulation.plan,
      actors,
      interactions,
      roundDigests,
      roleTraces: [
        ...state.simulation.roleTraces.filter((trace) => trace.role !== "coordinator"),
        coordinatorTrace,
      ],
      worldSummary,
      stopReason,
    },
  }
}

function throwIfCanceled(isCanceled?: () => boolean): void {
  if (isCanceled?.()) {
    throw new Error("Run canceled.")
  }
}

async function runActorGraph(
  state: WorkflowState,
  actors: ActorState[],
  actor: ActorState,
  event: PlannedEvent,
  roundDigest: RoundDigest,
  roundIndex: number,
  coordinatorTrace: CoordinatorTrace,
  emit: (event: RunEvent) => Promise<void>
): Promise<ActorGraphResult> {
  const graph = createActorGraph(emit)
  const result = await graph.invoke(
    createActorGraphState({
      runId: state.runId,
      scenario: state.scenario,
      plannerDigest: plannerDigestSummary(state.simulation.plan, state.scenario.text),
      settings: state.settings,
      actor,
      actors,
      event,
      roundDigest,
      roundIndex,
      coordinatorTrace,
    })
  )
  if (!result.decision) {
    throw new Error(`actor graph for ${actor.id} completed without a decision.`)
  }
  return { actorId: actor.id, decision: result.decision }
}

async function runCoordinatorTextNode(
  state: WorkflowState,
  step: CoordinatorTraceStep,
  promptBuilder: CoordinatorPromptBuilder,
  partial: Partial<Record<CoordinatorTraceStep, string>>,
  emit: (event: RunEvent) => Promise<void>
): Promise<{ text: string; retries: number }> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const prompt = withPromptLanguageGuide(promptBuilder(state, partial), state.scenario.language)
    const result = await invokeRoleTextWithMetrics(state.settings, "coordinator", step, attempt, prompt)
    await emit({
      type: "model.metrics",
      runId: state.runId,
      timestamp: timestamp(),
      metrics: result.metrics,
    })
    const response = normalizeCoordinatorText(result.text, step, state)
    if (response) {
      await emit({
        type: "model.message",
        runId: state.runId,
        timestamp: timestamp(),
        role: "coordinator",
        content: `${step}: ${response}`,
      })
      return { text: response, retries: attempt - 1 }
    }

    await emit({
      type: "log",
      runId: state.runId,
      timestamp: timestamp(),
      level: "warn",
      message: `coordinator.${step} returned empty text on attempt ${attempt}/${MAX_ATTEMPTS}.`,
    })
  }

  throw new Error(`coordinator.${step} failed after ${MAX_ATTEMPTS} empty responses.`)
}

async function runCoordinatorValidatedNode(
  state: WorkflowState,
  step: CoordinatorTraceStep,
  promptBuilder: CoordinatorPromptBuilder,
  emit: (event: RunEvent) => Promise<void>,
  select: (value: string) => string | undefined,
  allowedOutputs: (state: WorkflowState) => string[],
  displayValue: (value: string) => string = (value) => value
): Promise<{ text: string; retries: number }> {
  const invalidResponses: string[] = []
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const allowed = allowedOutputs(state)
    const retryGuide = invalidResponses.length
      ? `\n\nPrevious invalid responses:\n${invalidResponses.map((item) => `- ${item}`).join("\n")}\nReturn one exact allowed output only:\n${allowed.map((item) => `- ${item}`).join("\n")}`
      : ""
    const prompt = withPromptLanguageGuide(promptBuilder(state, {}) + retryGuide, state.scenario.language)
    const result = await invokeRoleTextWithMetrics(state.settings, "coordinator", step, attempt, prompt)
    await emit({
      type: "model.metrics",
      runId: state.runId,
      timestamp: timestamp(),
      metrics: result.metrics,
    })
    const response = result.text.trim()
    const selected = select(response)
    if (selected) {
      await emit({
        type: "model.message",
        runId: state.runId,
        timestamp: timestamp(),
        role: "coordinator",
        content: `${step}: ${displayValue(selected)}`,
      })
      return { text: selected, retries: attempt - 1 }
    }
    const repaired = await repairExactChoice({
      runId: state.runId,
      scenario: state.scenario,
      settings: state.settings,
      sourceRole: "coordinator",
      sourceStep: step,
      invalidText: response || "<empty>",
      allowedOutputs: allowed,
      emit,
    })
    const repairedSelection = repaired ? select(repaired) : undefined
    if (repairedSelection) {
      await emit({
        type: "model.message",
        runId: state.runId,
        timestamp: timestamp(),
        role: "coordinator",
        content: `${step}: ${displayValue(repairedSelection)}`,
      })
      return { text: repairedSelection, retries: attempt - 1 }
    }
    invalidResponses.push(preview(response))
    await emit({
      type: "log",
      runId: state.runId,
      timestamp: timestamp(),
      level: "warn",
      message: `coordinator.${step} returned invalid text on attempt ${attempt}/${MAX_ATTEMPTS}: ${preview(response)}`,
    })
  }
  throw new Error(`coordinator.${step} failed after ${MAX_ATTEMPTS} invalid responses.`)
}

async function resolveEventInjection(
  state: WorkflowState,
  emit: (event: RunEvent) => Promise<void>,
  events: PlannedEvent[]
): Promise<{ text: string; retries: number }> {
  if (!events.some(isInjectableEvent)) {
    return { text: "None", retries: 0 }
  }

  return runCoordinatorValidatedNode(
    state,
    "eventInjection",
    coordinatorPrompts.eventInjection,
    emit,
    (value) => selectEventInjection(value, events),
    () => eventInjectionAllowedOutputs(events),
    (value) => eventInjectionDisplayValue(value, events)
  )
}

function normalizeCoordinatorText(value: string, step: CoordinatorTraceStep, state: WorkflowState): string {
  const trimmed = value.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim()
  const labels = [step, coordinatorStepLabel(step), coordinatorStepLabel(step).replace(/\s+/g, "")]
  const withoutPrefix = labels.reduce((current, label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return current.replace(new RegExp(`^\\s*(?:\\*\\*)?${escaped}(?:\\*\\*)?\\s*[:：-]\\s*`, "i"), "")
  }, trimmed)
  const maxCharacters = scalePromptLimit(700, state.scenario.controls)
  return withoutPrefix.length > maxCharacters ? withoutPrefix.slice(0, maxCharacters).trim() : withoutPrefix
}

function coordinatorStepLabel(step: CoordinatorTraceStep): string {
  if (step === "runtimeFrame") return "Runtime Frame"
  if (step === "actorRouting") return "Actor Routing"
  if (step === "interactionPolicy") return "Interaction Policy"
  if (step === "outcomeDirection") return "Outcome Direction"
  if (step === "eventInjection") return "Event Injection"
  if (step === "eventResolution") return "Event Resolution"
  if (step === "progressDecision") return "Progress Decision"
  return "Extension Decision"
}

function updateCoordinatorTrace(
  trace: CoordinatorTrace,
  step: CoordinatorTraceStep,
  text: string,
  retries: number
): CoordinatorTrace {
  return {
    ...trace,
    [step]: text,
    retryCounts: {
      ...trace.retryCounts,
      [step]: retries,
    },
  }
}

function workflowSnapshot(
  state: WorkflowState,
  actors: ActorState[],
  interactions: Interaction[],
  roundDigests: RoundDigest[],
  events: PlannedEvent[],
  maxRound: number
): WorkflowState {
  return {
    ...state,
    scenario: {
      ...state.scenario,
      controls: {
        ...state.scenario.controls,
        maxRound,
      },
    },
    simulation: {
      ...state.simulation,
      actors,
      interactions,
      roundDigests,
      plan: state.simulation.plan ? { ...state.simulation.plan, majorEvents: events } : state.simulation.plan,
      worldSummary: `${summarizeInteractions(interactions)} ${summarizeEvents(events)}`,
    },
  }
}

function selectProgressDecision(value: string): string | undefined {
  const selected = value.trim()
  return selected === "continue" || selected === "stop" || selected === "complete" ? selected : undefined
}

function selectEventResolution(value: string): string | undefined {
  const selected = value.trim()
  return selected === "completed" || selected === "partial" ? selected : undefined
}

function selectExtensionDecision(value: string): string | undefined {
  const selected = value.trim()
  return selected === "continue" || selected === "stop" ? selected : undefined
}

function hasUnresolvedEvents(events: PlannedEvent[]): boolean {
  return events.some((event) => event.status === "pending" || event.status === "partial")
}

function isNoProgressCandidate(roundIndex: number, interactions: Interaction[], roundDigests: RoundDigest[]): boolean {
  if (roundIndex < 2) {
    return false
  }
  const recentRounds = new Set([roundIndex - 1, roundIndex])
  const recentInteractions = interactions.filter((interaction) => recentRounds.has(interaction.roundIndex))
  const recentDigests = roundDigests.filter((digest) => recentRounds.has(digest.roundIndex))
  const noInjectedEvents = recentDigests.every((digest) => !digest.injectedEventId)
  const noMeaningfulActions =
    recentInteractions.length === 0 || recentInteractions.every((interaction) => interaction.decisionType === "no_action")
  return noInjectedEvents && noMeaningfulActions
}

function preview(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim()
  return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact || "<empty>"
}

function timestamp(): string {
  return new Date().toISOString()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
