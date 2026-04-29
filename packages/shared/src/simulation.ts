import type { RoleTraceStep, SimulationRole, PlannerTraceStep, CoordinatorTraceStep } from "./model"
import type { ScenarioInput } from "./scenario"

export type StopReason = "" | "simulation_done" | "no_progress" | "failed" | "canceled"
export type ActionVisibility = "public" | "semi-public" | "private" | "solitary"
export type ActorDecisionType = "action" | "no_action"

export interface ActorState {
  id: string
  name: string
  role: string
  backgroundHistory: string
  personality: string
  preference: string
  privateGoal: string
  intent: string
  actions: ActorAction[]
  context: ActorContextMemory
  contextSummary: string
  memory: string[]
  relationships: Record<string, string>
}

export interface ActorRosterEntry {
  index: number
  name: string
  roleSeed: string
}

export interface ActorAction {
  id: string
  visibility: ActionVisibility
  label: string
  intentHint: string
  expectedOutcome: string
}

export interface ActorContextMemory {
  public: string[]
  semiPublic: Record<string, string[]>
  private: Record<string, string[]>
  solitary: string[]
}

export interface ActorDecision {
  actorId: string
  actionId?: string
  decisionType: ActorDecisionType
  visibility: ActionVisibility
  targetActorIds: string[]
  intent: string
  message?: string
  expectation: string
  contextUsed: string[]
}

export interface PlannedEvent {
  id: string
  title: string
  summary: string
  status: "pending" | "active" | "completed" | "missed"
  participantIds: string[]
}

export interface ScenarioDigest {
  coreSituation: string
  actorPressures: string
  conflictDynamics: string
  simulationDirection: string
}

export interface Interaction {
  id: string
  roundIndex: number
  sourceActorId: string
  targetActorIds: string[]
  actionType: string
  content: string
  eventId: string
  visibility: ActionVisibility
  decisionType: ActorDecisionType
  intent: string
  expectation: string
}

export interface RoundDigest {
  roundIndex: number
  preRound: {
    elapsedTime: string
    content: string
  }
  afterRound: {
    content: string
  }
  injectedEventId?: string
}

export interface RoundReport {
  roundIndex: number
  title: string
  summary: string
  keyInteractions: string[]
  actorImpacts: string[]
  unresolvedQuestions: string[]
}

export interface StandardRoleTrace {
  role: Exclude<SimulationRole, "planner" | "coordinator">
  thought: string
  target: string
  action: string
  intent: string
  retryCounts: Record<RoleTraceStep, number>
}

export interface PlannerTrace {
  role: "planner"
  coreSituation: string
  actorPressures: string
  conflictDynamics: string
  simulationDirection: string
  majorEvents: string
  retryCounts: Record<PlannerTraceStep, number>
}

export interface CoordinatorTrace {
  role: "coordinator"
  runtimeFrame: string
  actorRouting: string
  interactionPolicy: string
  outcomeDirection: string
  eventInjection: string
  progressDecision: string
  extensionDecision: string
  retryCounts: Record<CoordinatorTraceStep, number>
}

export type RoleTrace = PlannerTrace | CoordinatorTrace | StandardRoleTrace

export interface SimulationState {
  runId: string
  scenario: ScenarioInput
  plan?: {
    interpretation: string
    backgroundStory: string
    scenarioDigest?: ScenarioDigest
    actionCatalog: string[]
    majorEvents: PlannedEvent[]
  }
  actors: ActorState[]
  actorRoster?: ActorRosterEntry[]
  interactions: Interaction[]
  roundDigests: RoundDigest[]
  roundReports: RoundReport[]
  roleTraces: RoleTrace[]
  observerRoundIndex?: number
  worldSummary: string
  reportMarkdown: string
  stopReason: StopReason
  errors: string[]
}
