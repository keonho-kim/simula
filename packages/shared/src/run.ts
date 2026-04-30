import type { ActorReadyView, GraphTimelineFrame } from "./graph"
import type {
  ActorCardStep,
  ActorTraceStep,
  CoordinatorTraceStep,
  GeneratorRosterStep,
  ModelRole,
  PlannerTraceStep,
} from "./model"
import type { InjectedEvent, Interaction, StopReason } from "./simulation"

export type RunStatus = "created" | "running" | "completed" | "failed" | "canceled"

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
  | { type: "actors.ready"; runId: string; timestamp: string; actors: ActorReadyView[] }
  | { type: "event.injected"; runId: string; timestamp: string; event: InjectedEvent }
  | { type: "interaction.recorded"; runId: string; timestamp: string; interaction: Interaction }
  | { type: "actor.message"; runId: string; timestamp: string; actorId: string; actorName: string; content: string }
  | { type: "round.completed"; runId: string; timestamp: string; roundIndex: number }
  | { type: "graph.delta"; runId: string; timestamp: string; frame: GraphTimelineFrame }
  | { type: "log"; runId: string; timestamp: string; level: "info" | "warn" | "error"; message: string }
  | { type: "report.delta"; runId: string; timestamp: string; content: string }
  | { type: "run.completed"; runId: string; timestamp: string; stopReason: StopReason }
  | { type: "run.failed"; runId: string; timestamp: string; error: string }
  | { type: "run.canceled"; runId: string; timestamp: string }
