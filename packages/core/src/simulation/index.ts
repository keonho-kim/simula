import { END, START, StateGraph } from "@langchain/langgraph"
import type {
  LLMSettings,
  RunEvent,
  ScenarioInput,
  SimulationState,
} from "@simula/shared"
import { renderReport } from "./reporting"
import { initialSimulationState, WorkflowAnnotation, type WorkflowState } from "./state"
import { createCoordinatorGraph } from "./roles/coordinator"
import { createGeneratorGraph } from "./roles/generator"
import { createObserverGraph } from "./roles/observer"
import { createPlannerGraph } from "./roles/planner"
import { validateSettings } from "../settings"

export {
  actorPromptContext,
  applyInteractionContext,
  applyPreRoundDigestContext,
  compressActorContext,
  contextUsedByActor,
  emptyActorContext,
  resolveActorContextTokenBudget,
} from "./context"
export { plannerDigestSummary, renderScenarioDigest } from "./plan"

export interface SimulationRunInput {
  runId: string
  scenario: ScenarioInput
  settings: LLMSettings
  emit: (event: RunEvent) => Promise<void>
  roundDelayMs?: number
}

export async function runSimulation(input: SimulationRunInput): Promise<SimulationState> {
  validateSettings(input.settings)

  const initialState: WorkflowState = {
    runId: input.runId,
    scenario: input.scenario,
    settings: input.settings,
    simulation: initialSimulationState(input.runId, input.scenario),
  }

  await input.emit({
    type: "run.started",
    runId: input.runId,
    timestamp: timestamp(),
  })
  if (input.scenario.controls.fastMode) {
    await input.emit({
      type: "log",
      runId: input.runId,
      timestamp: timestamp(),
      level: "info",
      message: "Fast Mode enabled; actor decisions and observer round reports run in parallel while dependency-sensitive stages remain sequential.",
    })
  }

  const graph = new StateGraph(WorkflowAnnotation)
    .addNode("planner", async (state) => runStage("planner", "Planner", state, input.emit, createPlannerGraph(input.emit)))
    .addNode("generator", async (state) =>
      runStage("generator", "Generator", state, input.emit, createGeneratorGraph(input.emit))
    )
    .addNode("coordinator", async (state) =>
      runStage("coordinator", "Coordinator", state, input.emit, createCoordinatorGraph(input.emit, input.roundDelayMs ?? 0))
    )
    .addNode("observer", async (state) => runObserverStage(state, input.emit))
    .addNode("finalization", async (state) => finalizationNode(state, input.emit))
    .addEdge(START, "planner")
    .addEdge("planner", "generator")
    .addEdge("generator", "coordinator")
    .addEdge("coordinator", "observer")
    .addEdge("observer", "finalization")
    .addEdge("finalization", END)
    .compile()

  const result = await graph.invoke(initialState)
  const finalState = result.simulation
  await input.emit({
    type: "run.completed",
    runId: input.runId,
    timestamp: timestamp(),
    stopReason: finalState.stopReason,
  })
  return finalState
}

async function runStage(
  nodeId: string,
  label: string,
  state: WorkflowState,
  emit: (event: RunEvent) => Promise<void>,
  graph: { invoke: (state: WorkflowState) => Promise<WorkflowState> }
): Promise<Partial<WorkflowState>> {
  await emitNodeStarted(state.runId, nodeId, label, emit)
  const result = await graph.invoke(state)
  if (nodeId === "generator") {
    await emit({
      type: "actors.ready",
      runId: state.runId,
      timestamp: timestamp(),
      actors: result.simulation.actors.map((actor) => ({
        id: actor.id,
        label: actor.name,
        role: actor.role,
        intent: actor.intent,
        interactionCount: 0,
      })),
    })
  }
  await emitNodeCompleted(state.runId, nodeId, label, emit)
  return { simulation: result.simulation }
}

async function runObserverStage(
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

interface ObserverRoundResult {
  events: RunEvent[]
  roundIndex: number
  simulation: SimulationState
}

type ObserverRoundTaskResult =
  | { ok: true; result: ObserverRoundResult }
  | { ok: false; events: RunEvent[]; roundIndex: number; error: unknown }

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

async function finalizationNode(
  state: WorkflowState,
  emit: (event: RunEvent) => Promise<void>
): Promise<Partial<WorkflowState>> {
  await emitNodeStarted(state.runId, "finalization", "Finalization", emit)
  const reportMarkdown = renderReport(state.simulation)
  await emit({ type: "report.delta", runId: state.runId, timestamp: timestamp(), content: reportMarkdown })
  await emitNodeCompleted(state.runId, "finalization", "Finalization", emit)
  return {
    simulation: {
      ...state.simulation,
      reportMarkdown,
    },
  }
}

async function emitNodeStarted(
  runId: string,
  nodeId: string,
  label: string,
  emit: (event: RunEvent) => Promise<void>
): Promise<void> {
  await emit({ type: "node.started", runId, timestamp: timestamp(), nodeId, label })
}

async function emitNodeCompleted(
  runId: string,
  nodeId: string,
  label: string,
  emit: (event: RunEvent) => Promise<void>
): Promise<void> {
  await emit({ type: "node.completed", runId, timestamp: timestamp(), nodeId, label })
}

function timestamp(): string {
  return new Date().toISOString()
}
