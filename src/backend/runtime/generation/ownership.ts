/**
 * Purpose: Coordinate durable generation lease lifecycle and terminal failure publication.
 * Pattern: Execution lifecycle coordinator.
 * Usage: Called after a job repository grants execution ownership.
 * Related: src/backend/storage/generation/execution-lease.ts
 */
import { GENERATION_LEASE_MS, GenerationCanceled, GenerationOwnershipLost, type ExecutionLease } from "@/backend/storage/generation/execution-lease"

export interface ExecutionParent { signal: AbortSignal; assertActive: () => void }

const LEASE_RENEWAL_MS = GENERATION_LEASE_MS / 6

export async function runWithGenerationLease<T>(lease: ExecutionLease, controller: AbortController, work: () => Promise<T>): Promise<T> {
  const heartbeat = setInterval(() => {
    try {
      if (!lease.renew()) controller.abort(new GenerationCanceled())
    } catch (error) { controller.abort(error); clearInterval(heartbeat) }
  }, LEASE_RENEWAL_MS)
  try { controller.signal.throwIfAborted(); return await work() }
  finally { clearInterval(heartbeat); lease.release() }
}

/** A cancellation racing with failure publication wins; an expired owner publishes nothing. */
export async function publishGenerationFailure(error: unknown, signal: AbortSignal, publish: (canceled: boolean) => Promise<void>): Promise<void> {
  if (error instanceof GenerationOwnershipLost || signal.reason instanceof GenerationOwnershipLost) return
  let canceled = signal.aborted || error instanceof GenerationCanceled
  for (;;) {
    try { await publish(canceled); return }
    catch (publicationError) {
      if (publicationError instanceof GenerationOwnershipLost) return
      if (publicationError instanceof GenerationCanceled && !canceled) { canceled = true; continue }
      throw publicationError
    }
  }
}
