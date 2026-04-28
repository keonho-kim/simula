import type { RunEvent, SimulationState } from "@simula/shared"
import { renderReport } from "./reporting"
import type { WorkflowState } from "./state"
import { createObserverGraph } from "./roles/observer"
import { emitNodeCompleted, emitNodeStarted, timestamp } from "./events"

interface ObserverRoundResult {
  events: RunEvent[]
  roundIndex: number
  simulation: SimulationState
}

type ObserverRoundTaskResult =
  | { ok: true; result: ObserverRoundResult }
  | { ok: false; events: RunEvent[]; roundIndex: number; error: unknown }

export async function runObserverStage(
  state: WorkflowState,
  emit: (event: RunEvent) => Promise<void>
): Promise<Partial<WorkflowState>> {
  await emitNodeStarted(state.runId, "observer", "Observer", emit)
  if (state.scenario.controls.fastMode) {
    const simulation = await runObserverRoundsInParallel(state, emit)
    await emitNodeCompleted(state.runId, "observer", "Observer", emit)
    return { simulation }
  }

  const graph = createObserverGraph(emit)
  let current = state
  for (const digest of state.simulation.roundDigests) {
    const result = await graph.invoke({
      ...current,
      simulation: {
        ...current.simulation,
        observerRoundIndex: digest.roundIndex,
      },
    })
    current = {
      ...current,
      simulation: {
        ...result.simulation,
        observerRoundIndex: undefined,
      },
    }
    const reportMarkdown = renderReport(current.simulation)
    await emit({ type: "report.delta", runId: state.runId, timestamp: timestamp(), content: reportMarkdown })
  }
  await emitNodeCompleted(state.runId, "observer", "Observer", emit)
  return { simulation: current.simulation }
}

async function runObserverRoundsInParallel(
  state: WorkflowState,
  emit: (event: RunEvent) => Promise<void>
): Promise<SimulationState> {
  const results = await Promise.all(
    state.simulation.roundDigests.map(async (digest) => runObserverRoundTask(state, digest.roundIndex))
  )
  let current = state.simulation

  for (const task of results.sort((a, b) => observerRoundTaskIndex(a) - observerRoundTaskIndex(b))) {
    const events = task.ok ? task.result.events : task.events
    for (const event of events) {
      await emit(event)
    }
    if (!task.ok) {
      throw task.error
    }
    const result = task.result
    current = mergeObserverRound(current, result)
    const reportMarkdown = renderReport(current)
    await emit({ type: "report.delta", runId: state.runId, timestamp: timestamp(), content: reportMarkdown })
  }

  return current
}

async function runObserverRoundTask(state: WorkflowState, roundIndex: number): Promise<ObserverRoundTaskResult> {
  const events: RunEvent[] = []
  const graph = createObserverGraph(async (event) => {
    events.push(event)
  })
  try {
    const result = await graph.invoke({
      ...state,
      simulation: {
        ...state.simulation,
        observerRoundIndex: roundIndex,
      },
    })
    return {
      ok: true,
      result: {
        events,
        roundIndex,
        simulation: {
          ...result.simulation,
          observerRoundIndex: undefined,
        },
      },
    }
  } catch (error) {
    return { ok: false, events, roundIndex, error }
  }
}

function observerRoundTaskIndex(task: ObserverRoundTaskResult): number {
  return task.ok ? task.result.roundIndex : task.roundIndex
}

function mergeObserverRound(current: SimulationState, result: ObserverRoundResult): SimulationState {
  const roundDigest = result.simulation.roundDigests.find((digest) => digest.roundIndex === result.roundIndex)
  const roundReport = result.simulation.roundReports.find((report) => report.roundIndex === result.roundIndex)
  const observerTrace = result.simulation.roleTraces.find((trace) => trace.role === "observer")

  return {
    ...current,
    roundDigests: roundDigest
      ? current.roundDigests.map((digest) => (digest.roundIndex === result.roundIndex ? roundDigest : digest))
      : current.roundDigests,
    roundReports: roundReport
      ? [...current.roundReports.filter((report) => report.roundIndex !== result.roundIndex), roundReport].sort(
          (a, b) => a.roundIndex - b.roundIndex
        )
      : current.roundReports,
    roleTraces: observerTrace
      ? [...current.roleTraces.filter((trace) => trace.role !== "observer"), observerTrace]
      : current.roleTraces,
  }
}

