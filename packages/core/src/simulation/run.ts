import { END, START, StateGraph } from "@langchain/langgraph"
import type { LLMSettings, RunEvent, ScenarioInput, SimulationState } from "@simula/shared"
import { validateSettings } from "../settings"
import { createCoordinatorGraph } from "./roles/coordinator"
import { createGeneratorGraph } from "./roles/generator"
import { createPlannerGraph } from "./roles/planner"
import { finalizationNode } from "./finalization"
import { runStage } from "./stages"
import { initialSimulationState, WorkflowAnnotation, type WorkflowState } from "./state"
import { timestamp } from "./events"

export interface SimulationRunInput {
  runId: string
  scenario: ScenarioInput
  settings: LLMSettings
  emit: (event: RunEvent) => Promise<void>
  roundDelayMs?: number
  waitForNextRound?: (roundIndex: number) => Promise<void>
  isCanceled?: () => boolean
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
      message: "Fast Mode enabled; actor decisions run in parallel while observer summaries and dependency-sensitive stages remain sequential.",
    })
  }

  const throwIfCanceled = () => {
    if (input.isCanceled?.()) {
      throw new Error("Run canceled.")
    }
  }
  const runCancelableNode = async <T>(operation: () => Promise<T>): Promise<T> => {
    throwIfCanceled()
    const result = await operation()
    throwIfCanceled()
    return result
  }

  const graph = new StateGraph(WorkflowAnnotation)
    .addNode("planner", async (state) =>
      runCancelableNode(() => runStage("planner", "Planner", state, input.emit, createPlannerGraph(input.emit)))
    )
    .addNode("generator", async (state) =>
      runCancelableNode(() => runStage("generator", "Generator", state, input.emit, createGeneratorGraph(input.emit)))
    )
    .addNode("coordinator", async (state) =>
      runCancelableNode(() =>
        runStage(
          "coordinator",
          "Coordinator",
          state,
          input.emit,
          createCoordinatorGraph(input.emit, input.roundDelayMs ?? 0, input.waitForNextRound, input.isCanceled)
        )
      )
    )
    .addNode("finalization", async (state) => runCancelableNode(() => finalizationNode(state, input.emit)))
    .addEdge(START, "planner")
    .addEdge("planner", "generator")
    .addEdge("generator", "coordinator")
    .addEdge("coordinator", "finalization")
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
