/**
 * Purpose: Orchestrate coordinator stages and the ordered simulation round loop.
 * Pattern: Workflow node.
 * Usage: Invoked by the coordinator LangGraph from graph.ts.
 * Related: src/backend/core/simulation/roles/coordinator/invocation.ts, src/backend/core/simulation/roles/coordinator/snapshot.ts
 */
import type {
  ActorState,
  CoordinatorTrace,
  CoordinatorTraceStep,
  InjectedEvent,
  Interaction,
  RoundDigest,
  RoundReport,
  RoleTrace,
  RunEvent,
  SimulationState,
  StopReason,
} from "@/shared"
import { applyInjectedEventContext, compressActorContext } from "@/backend/core/simulation/actors/memory"
import { retainActorMemories } from "@/backend/core/simulation/actors/retain-memory"

import {
  buildPreRoundDigest,
  continuityEvent,
  eventForInjection,
  injectedEventForRound,
} from "@/backend/core/simulation/events/injection"
import { renderReport, summarizeEvents, summarizeInteractions } from "@/backend/core/simulation/outputs/report"
import { upsertRoleTrace, type WorkflowState } from "@/backend/core/simulation/workflow/state"

import { runObserverRound } from "@/backend/core/simulation/roles/observer/nodes"
import type { CoordinatorPromptBuilder } from "@/backend/core/simulation/roles/coordinator/prompts"
import { coordinatorPrompts } from "@/backend/core/simulation/roles/coordinator/prompts"
import {
  coordinatorTracePartial,
  getCoordinatorTrace,
} from "@/backend/core/simulation/roles/coordinator/state"

import { progressPrompt } from "./prompts/progress-decision"
import { progressSnapshot, selectProgressDecision } from "./progress"
import {
  resolveEventInjection,
  runCoordinatorChoice,
  runCoordinatorText,
  updateCoordinatorTrace,
} from "./invocation"
import { coordinatorSnapshot } from "./snapshot"
import { actorExecutionBatches, runActorRound } from "./actor-round"

export function createCoordinatorStepNode(
  step: CoordinatorTraceStep,
  promptBuilder: CoordinatorPromptBuilder,
  emit: (event: RunEvent) => Promise<void>
): (state: WorkflowState) => Promise<Partial<WorkflowState>> {
  return async (state) => {
    const currentTrace = getCoordinatorTrace(state.simulation)
    const partial = coordinatorTracePartial(currentTrace)
    const result = await runCoordinatorText(state, step, promptBuilder, partial, emit)
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
  isCanceled?: () => boolean,
  saveState?: (state: SimulationState) => Promise<void>
): Promise<Partial<WorkflowState>> {
  const trace = getCoordinatorTrace(state.simulation)
  const events = (state.simulation.plan?.majorEvents ?? []).map((event) => ({ ...event }))
  let actors = state.simulation.actors.map((actor) => ({ ...actor }))
  let coordinatorTrace = trace
  const interactions: Interaction[] = []
  const roundDigests: RoundDigest[] = []
  let roundReports: RoundReport[] = [...state.simulation.roundReports]
  let roleTraces: RoleTrace[] = state.simulation.roleTraces
  const maxRound = Math.max(1, state.scenario.controls.maxRound ?? 8)
  let stopReason: StopReason = "simulation_done"
  const autonomous = state.scenario.controls.autonomousProgress === true
  let previousProgress = autonomous ? progressSnapshot(state) : ""
  const snapshot = () => coordinatorSnapshot(state, {
    actors,
    interactions,
    roundDigests,
    roundReports,
    roleTraces,
    coordinatorTrace,
    events,
  })
  const saveSnapshot = async () => {
    if (!saveState) return
    const current = snapshot().simulation
    await saveState({ ...current, reportMarkdown: renderReport(current) })
  }
  for (let roundIndex = 1; autonomous || roundIndex <= maxRound; roundIndex += 1) {
    throwIfCanceled(isCanceled)
    const injectionResult = await resolveEventInjection(snapshot(), events, emit)
    coordinatorTrace = updateCoordinatorTrace(coordinatorTrace, "eventInjection", injectionResult.text, injectionResult.retries)
    const selectedEvent = eventForInjection(injectionResult.text, events)
    const event = selectedEvent ?? continuityEvent(roundIndex)
    let injectedEvent: InjectedEvent | undefined = undefined
    if (selectedEvent) {
      injectedEvent = injectedEventForRound(roundIndex, selectedEvent, actors)
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
    actors = await updateActorMemories(actors, state.scenario.controls.fastMode,
      (actor) =>
        compressActorContext(actor, {
          runId: state.runId,
          scenario: state.scenario,
          settings: state.settings,
          roundIndex,
          emit,
        })
    )

    const actorRound = await runActorRound(
      state,
      actors,
      event,
      roundDigest,
      roundIndex,
      coordinatorTrace,
      emit
    )
    actors = actorRound.actors
    interactions.push(...actorRound.interactions)
    await saveSnapshot()
    actors = await retainActorMemories(actors, { runId: state.runId, scenario: state.scenario,
      settings: state.settings, emit }, state.scenario.controls.fastMode)
    await saveSnapshot()
    throwIfCanceled(isCanceled)
    if (selectedEvent) {
      const resolutionResult = await runCoordinatorChoice(
        snapshot(),
        "eventResolution",
        coordinatorPrompts.eventResolution,
        emit,
        selectEventResolution,
        ["completed", "partial"]
      )
      coordinatorTrace = updateCoordinatorTrace(
        coordinatorTrace,
        "eventResolution",
        resolutionResult.text,
        resolutionResult.retries
      )
      selectedEvent.status = resolutionResult.text === "partial" ? "partial" : "completed"
    }

    let stopAfterRound = !autonomous && roundIndex === maxRound
    if (autonomous) {
      const current = snapshot()
      const currentProgress = progressSnapshot(current)
      const progressResult = await runCoordinatorChoice(
        current,
        "progressDecision",
        () => progressPrompt(previousProgress, currentProgress, state.scenario.text),
        emit,
        selectProgressDecision,
        ["1", "0"]
      )
      coordinatorTrace = updateCoordinatorTrace(coordinatorTrace, "progressDecision", progressResult.text, progressResult.retries)
      throwIfCanceled(isCanceled)
      stopAfterRound = progressResult.text === "0"
      if (stopAfterRound) {
        stopReason = events.some(event => event.status !== "completed") ? "no_progress" : "simulation_done"
      }
      previousProgress = currentProgress
    }
    const observerInput = snapshot()
    const observed = await runObserverRound(
      {
        ...observerInput,
        simulation: {
          ...observerInput.simulation,
          observerRoundIndex: roundIndex,
        },
      },
      emit
    )
    roundReports = observed.simulation.roundReports
    roleTraces = observed.simulation.roleTraces
    await emit({ type: "report.delta", runId: state.runId, timestamp: timestamp(), content: renderReport(observed.simulation) })
    await emit({
      type: "round.completed",
      runId: state.runId,
      timestamp: new Date().toISOString(),
      roundIndex,
      awaitsContinuation: !stopAfterRound && Boolean(waitForNextRound),
    })
    if (stopAfterRound) {
      break
    }
    if (waitForNextRound) {
      await waitForNextRound(roundIndex)
    } else if (roundDelayMs > 0) {
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
      roundReports,
      roleTraces,
      worldSummary,
      stopReason,
    },
  }
}

async function updateActorMemories(actors: ActorState[], fastMode: boolean, update: (actor: ActorState) => Promise<ActorState>): Promise<ActorState[]> {
  const updated: ActorState[] = []
  for (const batch of actorExecutionBatches(actors, fastMode)) updated.push(...await Promise.all(batch.map(update)))
  return updated
}

function throwIfCanceled(isCanceled?: () => boolean): void {
  if (isCanceled?.()) {
    throw new Error("Run canceled.")
  }
}

function selectEventResolution(value: string): string | undefined {
  const selected = value.trim()
  return selected === "completed" || selected === "partial" ? selected : undefined
}

function timestamp(): string {
  return new Date().toISOString()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
