/**
 * Purpose: Define scoped task lifecycle and draft events shared by builders and analytical reports.
 * Pattern: Serializable generation contract.
 * Usage: Used by bounded task execution, progress transport, and browser projections.
 * Related: src/backend/core/generation/tasks.ts, src/backend/runtime/generation/progress.ts
 */
import type { ModelMetrics } from "./run"
import type { GenerationPreviewField } from "./generation-preview"

export const GENERATION_TASK_KINDS = ["evidence", "digest", "facet", "situation", "roster", "participant", "rules", "source-access", "check",
  "report-evidence", "perspective", "swot", "assessment", "trajectory", "report-detail", "conclusion"] as const
export type GenerationTaskKind = typeof GENERATION_TASK_KINDS[number]
export type GenerationTaskScope = { kind: "document"; id: string } | { kind: "participant"; name: string } | { kind: "facet" | "rule"; key: string }

export type GenerationEvent =
  | { type: "task"; taskId: string; kind: GenerationTaskKind; scope?: GenerationTaskScope; attempt: number; status: "waiting" | "running" | "retrying" | "completed" | "failed"; issue?: string }
  | { type: "draft"; taskId: string; attempt: number; sequence: number; text: string }
  | { type: "metrics"; taskId: string; metrics: ModelMetrics }

export type GenerationPreviewDraft = Omit<Extract<GenerationEvent, { type: "draft" }>, "text"> & { fields: GenerationPreviewField[] }
export type GenerationProgressEvent =
  | { type: "snapshot"; executionId: string; tasks: Array<Extract<GenerationEvent, { type: "task" }>>; draft?: GenerationPreviewDraft }
  | { type: "event"; executionId: string; event: Exclude<GenerationEvent, { type: "draft" }> | GenerationPreviewDraft }
  | { type: "terminal"; executionId: string }
