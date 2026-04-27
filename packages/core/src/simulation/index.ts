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

export { applyInteractionContext, applyPreRoundDigestContext, contextUsedByActor, emptyActorContext } from "./context"

export interface SimulationRunInput {
  runId: string
  scenario: ScenarioInput
  settings: LLMSettings
  emit: (event: RunEvent) => Promise<void>
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
      message: "Fast Mode enabled; dependency-sensitive stages remain sequential.",
    })
  }

  const graph = new StateGraph(WorkflowAnnotation)
    .addNode("planner", async (state) => runStage("planner", "Planner", state, input.emit, createPlannerGraph(input.emit)))
    .addNode("generator", async (state) =>
      runStage("generator", "Generator", state, input.emit, createGeneratorGraph(input.emit))
    )
    .addNode("coordinator", async (state) =>
      runStage("coordinator", "Coordinator", state, input.emit, createCoordinatorGraph(input.emit))
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
  await emitNodeCompleted(state.runId, nodeId, label, emit)
  return { simulation: result.simulation }
}

async function runObserverStage(
  state: WorkflowState,
  emit: (event: RunEvent) => Promise<void>
): Promise<Partial<WorkflowState>> {
  await emitNodeStarted(state.runId, "observer", "Observer", emit)
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
