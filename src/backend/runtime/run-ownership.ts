/**
 * Purpose: Own a run lease and connect durable cancellation to models and round waiters.
 * Pattern: Execution lifecycle coordinator.
 * Usage: Shared by simulation execution and legacy commentary regeneration.
 * Related: src/backend/runtime/generation/ownership.ts, src/backend/runtime/round-continuation.ts
 */
import { GenerationOwnershipLost, type ExecutionLease } from "@/backend/storage/generation/execution-lease"
import type { RunStore } from "@/backend/storage/runs/run-store"
import type { RoundContinuationStore } from "./round-continuation"
import { runWithGenerationLease } from "./generation/ownership"

export async function runWithRunOwnership(store: RunStore, runId: string, runningRuns: Set<string>, continuations: RoundContinuationStore,
  work: (lease: ExecutionLease, signal: AbortSignal) => Promise<void>): Promise<void> {
  const lease = store.execution(runId).claim()
  if (!lease) return
  const controller = new AbortController()
  const localSignal = continuations.signal(runId)
  const signal = AbortSignal.any([controller.signal, localSignal])
  const stopWaiters = () => continuations.cancel(runId)
  const persistCancel = () => {
    try { lease.requestCancel() }
    catch (error) { if (!(error instanceof GenerationOwnershipLost)) controller.abort(error) }
  }
  controller.signal.addEventListener("abort", stopWaiters)
  localSignal.addEventListener("abort", persistCancel)
  if (localSignal.aborted) persistCancel()
  try { await runWithGenerationLease(lease, controller, () => work(lease, signal)) }
  finally {
    controller.signal.removeEventListener("abort", stopWaiters)
    localSignal.removeEventListener("abort", persistCancel)
    runningRuns.delete(runId)
    continuations.clearRun(runId)
    store.releaseTimeline(runId)
  }
}
