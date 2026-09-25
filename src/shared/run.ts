/**
 * Purpose: Define serializable run lifecycle, model measurements, and event contracts.
 * Pattern: Shared domain contract.
 * Usage: Consumed by backend persistence and browser event projections.
 * Related: src/shared/run-schema.ts, src/backend/integrations/llm/invoke.ts
 */
import type { ReportCommentary } from "./report-commentary"
import type { ModelCallFailure } from "./model-failure"
import type { ScenarioBoardUpdate } from "./scenario-board"
import type { ActorReadyView, GraphTimelineFrame } from "@/shared/graph"
import type {
  ActorCardStep,
  ActorTraceStep,
  CoordinatorTraceStep,
  GeneratorRosterStep,
  ModelRole,
  ObserverTraceStep,
  PlannerTraceStep,
} from "@/shared/model"
import type { InjectedEvent, Interaction, StopReason } from "@/shared/simulation"

export type RunStatus = "created" | "running" | "completed" | "failed" | "canceled" | "interrupted"

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
  usageAccountingVersion?: 1
  createdAt: string
  batchId?: string
  startedAt?: string
  completedAt?: string
  scenarioName?: string
  stopReason?: StopReason
  artifactPaths: RunArtifactPaths
  error?: string
}

export interface ModelMetrics {
  role: ModelRole
  step:
    | ActorTraceStep
    | PlannerTraceStep
    | CoordinatorTraceStep
    | ObserverTraceStep
    | GeneratorRosterStep
    | ActorCardStep
    | "actionCatalog"
    | "eventAudience"
    | "reportCommentary"
    | "draft"
  attempt: number
  ttftMs: number
  durationMs: number
  queueWaitMs?: number
  inputTokens: number
  reasoningTokens: number
  outputTokens: number
  totalTokens: number
  tokenSource: "provider" | "unavailable"
}

export type RunEvent =
  | { type: "report.commentary"; runId: string; timestamp: string; update: ReportCommentary }
  | { type: "board.updated"; runId: string; timestamp: string; update: ScenarioBoardUpdate }
  | { type: "run.started"; runId: string; timestamp: string }
  | { type: "node.started"; runId: string; timestamp: string; nodeId: string; label: string }
  | { type: "node.completed"; runId: string; timestamp: string; nodeId: string; label: string }
  | { type: "node.failed"; runId: string; timestamp: string; nodeId: string; label: string; error: string }
  | { type: "model.message"; runId: string; timestamp: string; role: ModelRole; content: string }
  | {
      type: "model.reasoning"
      runId: string
      timestamp: string
      role: ModelRole
      step: ModelMetrics["step"]
      attempt: number
      content: string
      reasoningTokens: number
      actorId?: string
      actorName?: string
    }
  | { type: "model.metrics"; runId: string; timestamp: string; metrics: ModelMetrics }
  | { type: "model.attempt.failed"; runId: string; timestamp: string; failure: ModelCallFailure }
  | { type: "actors.ready"; runId: string; timestamp: string; actors: ActorReadyView[] }
  | { type: "event.injected"; runId: string; timestamp: string; event: InjectedEvent }
  | { type: "interaction.recorded"; runId: string; timestamp: string; interaction: Interaction }
  | { type: "actor.message"; runId: string; timestamp: string; actorId: string; actorName: string; content: string }
  | { type: "round.completed"; runId: string; timestamp: string; roundIndex: number; awaitsContinuation?: boolean }
  | { type: "graph.delta"; runId: string; timestamp: string; frame: GraphTimelineFrame }
  | { type: "log"; runId: string; timestamp: string; level: "info" | "warn" | "error"; message: string }
  | { type: "report.delta"; runId: string; timestamp: string; content: string }
  | { type: "run.completed"; runId: string; timestamp: string; stopReason: StopReason }
  | { type: "run.failed"; runId: string; timestamp: string; error: string }
  | { type: "run.canceled"; runId: string; timestamp: string }
