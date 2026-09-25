/**
 * Purpose: Own cancellation signals and wait for notified per-round approvals.
 * Pattern: Run lifecycle with a scoped process subscription.
 * Usage: API controls and runtime execution share one instance.
 * Related: src/backend/runtime/execute-run.ts, src/backend/api/runs/run-controller.ts
 */
import type { ExecutionLease } from "@/backend/storage/generation/execution-lease"
import type { RoundApprovals } from "@/backend/storage/runs/round-approvals"

export class RunCanceledError extends Error {
  constructor() {
    super("Run canceled.")
    this.name = "RunCanceledError"
  }
}

export class RoundContinuationStore {
  private readonly canceled = new Set<string>()
  private readonly controllers = new Map<string, AbortController>()
  private readonly waiters = new Map<string, () => void>()

  notify(runId: string): void { this.waiters.get(runId)?.() }

  wait(runId: string, roundIndex: number, approvals: RoundApprovals, lease: ExecutionLease): Promise<void> {
    const signal = this.signal(runId)
    if (signal.aborted) return Promise.reject(new RunCanceledError())
    if (this.waiters.has(runId)) return Promise.reject(new Error("A round wait is already registered."))
    approvals.open(roundIndex, lease)
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (error?: unknown) => {
        if (settled) return
        settled = true
        signal.removeEventListener("abort", abort)
        this.waiters.delete(runId)
        if (error) reject(error)
        else resolve()
      }
      const abort = () => finish(new RunCanceledError())
      const check = () => {
        try { if (approvals.consume(roundIndex, lease)) finish() }
        catch (error) { finish(error) }
      }
      this.waiters.set(runId, check)
      signal.addEventListener("abort", abort, { once: true })
      check()
    })
  }

  cancel(runId: string): void {
    this.canceled.add(runId)
    this.controllers.get(runId)?.abort(new RunCanceledError())
  }

  isCanceled(runId: string): boolean {
    return this.canceled.has(runId)
  }

  signal(runId: string): AbortSignal {
    let controller = this.controllers.get(runId)
    if (!controller) {
      controller = new AbortController()
      this.controllers.set(runId, controller)
      if (this.canceled.has(runId)) controller.abort(new RunCanceledError())
    }
    return controller.signal
  }

  clearRun(runId: string): void {
    this.controllers.get(runId)?.abort(new RunCanceledError())
    this.controllers.delete(runId)
    this.canceled.delete(runId)
  }
}
