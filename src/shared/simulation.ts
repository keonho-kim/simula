import type { ReportCommentary } from "./report-commentary"
import type { RoleTraceStep, SimulationRole, PlannerTraceStep, CoordinatorTraceStep, ObserverTraceStep } from "@/shared/model"
import type { ScenarioInput } from "@/shared/scenario"

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

export type ActionCatalog = Record<string, ActorAction>

export interface ActorAction {
  id: string
  visibility: ActionVisibility
  label: string
  intentHint: string
  expectedOutcome: string
}

export interface ActorContextMemory {
  visible: ActorVisibleContextEntry[]
}

export type ActorVisibleContextKind = "event" | "out" | "in" | "observed" | "self"

export interface ActorVisibleContextEntry {
  id: string
  kind: ActorVisibleContextKind
  roundIndex: number
  content: string
  decisionType?: ActorDecisionType
  visibility?: ActionVisibility
  sourceActorId?: string
  targetActorIds?: string[]
  eventId?: string
}

export interface ActorDecision {
  actorId: string
  thought?: string
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
  status: "pending" | "active" | "partial" | "completed" | "missed"
  participantIds: string[]
}

export interface InjectedEvent {
  id: string
  roundIndex: number
  sourceEventId: string
  title: string
  summary: string
}

export interface ScenarioDigest {
  coreSituation: string
  actorPressures: string
  conflictDynamics: string
  simulationDirection: string
}

export interface Interaction {
  id: string
  thought?: string
  roundIndex: number
  sourceActorId: string
  targetActorIds: string[]
  actionType: string
  actionCode?: string
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
  injectedEventId?: string
}

export interface RoundReport {
  roundIndex: number
  title: string
  roundSummary: string
}

export interface StandardRoleTrace {
  role: Exclude<SimulationRole, "planner" | "coordinator" | "observer">
  thought: string
  target: string
  action: string
  intent: string
  retryCounts: Record<RoleTraceStep, number>
}

export interface ObserverTrace {
  role: "observer"
  roundSummary: string
  retryCounts: Record<ObserverTraceStep, number>
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
  eventResolution: string
  progressDecision: string
  extensionDecision: string
  retryCounts: Record<CoordinatorTraceStep, number>
}

export type RoleTrace = PlannerTrace | CoordinatorTrace | ObserverTrace | StandardRoleTrace

export interface SimulationState {
  runId: string
  scenario: ScenarioInput
  plan?: {
    interpretation: string
    backgroundStory: string
    scenarioDigest?: ScenarioDigest
    actionCatalog: ActionCatalog
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
  reportCommentary?: ReportCommentary
  reportMarkdown: string
  stopReason: StopReason
  errors: string[]
}
