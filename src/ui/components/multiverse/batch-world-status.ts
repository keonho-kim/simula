/**
 * Purpose: Translate batch and simulation lifecycle states consistently across their views.
 * Pattern: Pure presentation mapping.
 * Usage: Used by the batch summary, simulation list, and selected controls.
 * Related: src/ui/components/multiverse/multiverse-panel.tsx, src/ui/components/multiverse/batch-world-list.tsx
 */
import type { BatchWorldStatus } from "@/shared/multiverse"
import type { UiTexts } from "@/ui/types/i18n"

export function batchStatusText(status: BatchWorldStatus | "partial", t: UiTexts): string {
  return { pending: t.batchPending, preparing: t.batchPreparing, running: t.batchRunning, waiting: t.batchWaiting, completed: t.batchCompleted,
    failed: t.batchFailed, canceled: t.batchCanceled, interrupted: t.batchInterrupted, partial: t.batchPartial }[status]
}

export function isActiveSimulation(status: BatchWorldStatus): boolean {
  return status === "pending" || status === "preparing" || status === "running" || status === "waiting"
}
