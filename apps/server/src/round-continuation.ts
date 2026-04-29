type Resolver = () => void
type Rejecter = (error: Error) => void

export class RunCanceledError extends Error {
  constructor() {
    super("Run canceled.")
    this.name = "RunCanceledError"
  }
}

export class RoundContinuationStore {
  private readonly approved = new Set<string>()
  private readonly canceled = new Set<string>()
  private readonly waiters = new Map<string, { resolve: Resolver; reject: Rejecter }>()

  continue(runId: string, roundIndex: number): void {
    const key = continuationKey(runId, roundIndex)
    const waiter = this.waiters.get(key)
    if (!waiter) {
      this.approved.add(key)
      return
    }
    this.waiters.delete(key)
    waiter.resolve()
  }

  wait(runId: string, roundIndex: number): Promise<void> {
    if (this.canceled.has(runId)) {
      return Promise.reject(new RunCanceledError())
    }
    const key = continuationKey(runId, roundIndex)
    if (this.approved.delete(key)) {
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      this.waiters.set(key, { resolve, reject })
    })
  }

  cancel(runId: string): void {
    this.canceled.add(runId)
    const prefix = `${runId}:`
    for (const [key, waiter] of this.waiters) {
      if (key.startsWith(prefix)) {
        this.waiters.delete(key)
        waiter.reject(new RunCanceledError())
      }
    }
  }

  isCanceled(runId: string): boolean {
    return this.canceled.has(runId)
  }

  clearRun(runId: string): void {
    const prefix = `${runId}:`
    this.canceled.delete(runId)
    for (const key of this.approved) {
      if (key.startsWith(prefix)) {
        this.approved.delete(key)
      }
    }
    for (const [key, waiter] of this.waiters) {
      if (key.startsWith(prefix)) {
        this.waiters.delete(key)
        waiter.reject(new RunCanceledError())
      }
    }
  }
}

function continuationKey(runId: string, roundIndex: number): string {
  return `${runId}:${roundIndex}`
}
