export type RunStatus = "created" | "running" | "completed" | "failed"
export type StopReason = "" | "simulation_done" | "no_progress" | "failed"
export type ModelProvider = "openai" | "anthropic" | "gemini" | "ollama" | "lmstudio" | "vllm" | "litellm"
export type ModelRole =
  | "storyBuilder"
  | "planner"
  | "generator"
  | "coordinator"
  | "actor"
  | "observer"
  | "repair"

export type SimulationRole = "planner" | "generator" | "coordinator" | "observer"
export type RoleTraceStep = "thought" | "target" | "action" | "intent"
export type ActorTraceStep = RoleTraceStep | "message" | "context"
export type PlannerTraceStep =
  | "coreSituation"
  | "actorPressures"
  | "conflictDynamics"
  | "simulationDirection"
  | "majorEvents"
export type CoordinatorTraceStep =
  | "runtimeFrame"
  | "actorRouting"
  | "interactionPolicy"
  | "outcomeDirection"
  | "eventInjection"
  | "progressDecision"
  | "extensionDecision"
export type GeneratorRosterStep = "roster"
export type ActorCardStep = "role" | "backgroundHistory" | "personality" | "preference"
export type ActionVisibility = "public" | "semi-public" | "private" | "solitary"
export type ActorDecisionType = "action" | "no_action"
export type PromptLanguage = "en" | "ko"

export interface ScenarioControls {
  numCast: number
  allowAdditionalCast: boolean
  actionsPerType: number
  maxRound: number
  fastMode: boolean
  actorContextTokenBudget?: number
}

export interface ScenarioInput {
  sourceName?: string
  text: string
  controls: ScenarioControls
  language?: PromptLanguage
}

export interface RoleSettings {
  provider: ModelProvider
  model: string
  temperature: number
  maxTokens: number
  timeoutSeconds: number
  topP?: number
  topK?: number
  frequencyPenalty?: number
  presencePenalty?: number
  seed?: number
  reasoningEffort?: "low" | "medium" | "high"
  contextTokenBudget?: number
  extraBody?: Record<string, unknown>
  safetySettings?: Array<Record<string, string>>
}

export interface ProviderSettings {
  baseUrl?: string
  apiKey?: string
  streamUsage?: boolean
  extraHeaders?: Record<string, string>
}

export type ProviderSettingsMap = Record<ModelProvider, ProviderSettings>
export type RoleSettingsMap = Record<ModelRole, RoleSettings>

export interface LLMSettings {
  providers: ProviderSettingsMap
  roles: RoleSettingsMap
}

export type LegacyLLMSettings = Partial<Record<ModelRole, RoleSettings & ProviderSettings>>
export type LLMSettingsInput = Partial<LLMSettings> | LegacyLLMSettings

export type ResolvedRoleSettings = RoleSettings & ProviderSettings

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
  role: string
  intent: string
  interactionCount: number
}

export interface GraphEdgeView {
  id: string
  source: string
  target: string
  visibility: ActionVisibility
  weight: number
  roundIndex: number
  latestContent: string
}

export interface GraphTimelineFrame {
  index: number
  timestamp: string
  nodes: GraphNodeView[]
  edges: GraphEdgeView[]
  activeNodeIds: string[]
  messages: string[]
  logRefs: string[]
  layoutRoundIndex?: number
}

export interface ModelMetrics {
  role: ModelRole
  step: ActorTraceStep | PlannerTraceStep | CoordinatorTraceStep | GeneratorRosterStep | ActorCardStep | "draft"
  attempt: number
  ttftMs: number
  durationMs: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  tokenSource: "provider" | "unavailable"
}

export type RunEvent =
  | { type: "run.started"; runId: string; timestamp: string }
  | { type: "node.started"; runId: string; timestamp: string; nodeId: string; label: string }
  | { type: "node.completed"; runId: string; timestamp: string; nodeId: string; label: string }
  | { type: "node.failed"; runId: string; timestamp: string; nodeId: string; label: string; error: string }
  | { type: "model.message"; runId: string; timestamp: string; role: ModelRole; content: string }
  | { type: "model.metrics"; runId: string; timestamp: string; metrics: ModelMetrics }
  | { type: "actors.ready"; runId: string; timestamp: string; actors: GraphNodeView[] }
  | { type: "interaction.recorded"; runId: string; timestamp: string; interaction: Interaction }
  | { type: "actor.message"; runId: string; timestamp: string; actorId: string; actorName: string; content: string }
  | { type: "round.completed"; runId: string; timestamp: string; roundIndex: number }
  | { type: "graph.delta"; runId: string; timestamp: string; frame: GraphTimelineFrame }
  | { type: "log"; runId: string; timestamp: string; level: "info" | "warn" | "error"; message: string }
  | { type: "report.delta"; runId: string; timestamp: string; content: string }
  | { type: "run.completed"; runId: string; timestamp: string; stopReason: StopReason }
  | { type: "run.failed"; runId: string; timestamp: string; error: string }

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

export interface CreateRunRequest {
  scenario: ScenarioInput
}

export interface SettingsResponse {
  settings: LLMSettings
}

export interface SettingsModelsRequest {
  provider: ModelProvider
  connection: ProviderSettings
}

export interface SettingsModelsResponse {
  models: string[]
}

export interface StoryBuilderMessage {
  role: "user" | "assistant"
  content: string
}

export interface StoryBuilderDraftRequest {
  messages: StoryBuilderMessage[]
  controls: ScenarioControls
  language?: PromptLanguage
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
