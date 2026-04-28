import { Annotation } from "@langchain/langgraph"
import type {
  LLMSettings,
  RoleTrace,
  ScenarioInput,
  SimulationState,
} from "@simula/shared"

export interface WorkflowState {
  runId: string
  scenario: ScenarioInput
  settings: LLMSettings
  simulation: SimulationState
}

export const WorkflowAnnotation = Annotation.Root({
  runId: Annotation<string>(),
  scenario: Annotation<ScenarioInput>(),
  settings: Annotation<LLMSettings>(),
  simulation: Annotation<SimulationState>(),
})

export function initialSimulationState(
  runId: string,
  scenario: ScenarioInput
): SimulationState {
  return {
    runId,
    scenario,
    actors: [],
    interactions: [],
    roundDigests: [],
    roundReports: [],
    roleTraces: [],
    worldSummary: "The scenario is ready to begin.",
    reportMarkdown: "",
    stopReason: "",
    errors: [],
  }
}

export function upsertRoleTrace(state: SimulationState, trace: RoleTrace): SimulationState {
  return {
    ...state,
    roleTraces: [
      ...state.roleTraces.filter((item) => item.role !== trace.role),
      trace,
    ],
  }
}
