export type RunStatus = "created" | "running" | "completed" | "failed"
export type StopReason = "" | "simulation_done" | "no_progress" | "failed"
export type ModelProvider = "openai" | "anthropic"
export type ModelRole =
  | "storyBuilder"
  | "planner"
  | "generator"
  | "coordinator"
  | "observer"
  | "repair"

export type SimulationRole = "planner" | "generator" | "coordinator" | "observer"
export type RoleTraceStep = "thought" | "target" | "action" | "intent"
export type ActionVisibility = "public" | "semi-public" | "private" | "solitary"
export type ActorDecisionType = "action" | "no_action"

export interface ScenarioControls {
  numCast: number
  allowAdditionalCast: boolean
  actionsPerType: number
  fastMode: boolean
}

export interface ScenarioInput {
  sourceName?: string
  text: string
  controls: ScenarioControls
}

export interface RoleSettings {
  provider: ModelProvider
  model: string
  apiKey?: string
  temperature: number
  maxTokens: number
  timeoutSeconds: number
}

export type LLMSettings = Record<ModelRole, RoleSettings>

export interface RunArtifactPaths {
  manifest: string
  events: string
  state: string
  report: string
  timeline: string
}

export interface RunManifest {
  id: string
  status: RunStatus
  createdAt: string
  startedAt?: string
  completedAt?: string
  scenarioName?: string
  stopReason?: StopReason
  artifactPaths: RunArtifactPaths
  error?: string
}

export interface GraphNodeView {
  id: string
  label: string
  kind: "stage" | "actor" | "event" | "artifact"
  status: "pending" | "running" | "completed" | "failed"
}

export interface GraphEdgeView {
  id: string
  source: string
  target: string
  label?: string
}

export interface GraphTimelineFrame {
  index: number
  timestamp: string
  nodes: GraphNodeView[]
  edges: GraphEdgeView[]
  activeNodeIds: string[]
  messages: string[]
  logRefs: string[]
}

export type RunEvent =
  | { type: "run.started"; runId: string; timestamp: string }
  | { type: "node.started"; runId: string; timestamp: string; nodeId: string; label: string }
  | { type: "node.completed"; runId: string; timestamp: string; nodeId: string; label: string }
  | { type: "node.failed"; runId: string; timestamp: string; nodeId: string; label: string; error: string }
  | { type: "model.message"; runId: string; timestamp: string; role: ModelRole; content: string }
  | { type: "actor.message"; runId: string; timestamp: string; actorId: string; actorName: string; content: string }
  | { type: "graph.delta"; runId: string; timestamp: string; frame: GraphTimelineFrame }
  | { type: "log"; runId: string; timestamp: string; level: "info" | "warn" | "error"; message: string }
  | { type: "report.delta"; runId: string; timestamp: string; content: string }
  | { type: "run.completed"; runId: string; timestamp: string; stopReason: StopReason }
  | { type: "run.failed"; runId: string; timestamp: string; error: string }

export interface ActorState {
  id: string
  name: string
  role: string
  privateGoal: string
  intent: string
  actions: ActorAction[]
  context: ActorContextMemory
  memory: string[]
  relationships: Record<string, string>
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
}

export interface RoundReport {
  roundIndex: number
  title: string
  summary: string
  keyInteractions: string[]
  actorImpacts: string[]
  unresolvedQuestions: string[]
}

export interface RoleTrace {
  role: SimulationRole
  thought: string
  target: string
  action: string
  intent: string
  retryCounts: Record<RoleTraceStep, number>
}

export interface SimulationState {
  runId: string
  scenario: ScenarioInput
  plan?: {
    interpretation: string
    backgroundStory: string
    actionCatalog: string[]
    majorEvents: PlannedEvent[]
  }
  actors: ActorState[]
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

export interface CreateRunRequest {
  scenario: ScenarioInput
}

export interface SettingsResponse {
  settings: LLMSettings
}

export interface StoryBuilderMessage {
  role: "user" | "assistant"
  content: string
}

export interface StoryBuilderDraftRequest {
  messages: StoryBuilderMessage[]
  controls: ScenarioControls
}

export interface StoryBuilderDraftResponse {
  text: string
}

export interface ScenarioSampleSummary {
  name: string
  title: string
  controls: ScenarioControls
}

export interface ScenarioSampleDetail {
  name: string
  title: string
  text: string
  controls: ScenarioControls
}

export interface ExportKindResponse {
  kind: "json" | "jsonl" | "md"
  contentType: string
  body: string
}
