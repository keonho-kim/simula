/**
 * Purpose: Bound model calls per resource pool and rotate queued work across execution owners.
 * Pattern: Fair admission queue with explicit permit lifetime.
 * Usage: Constructed once by the server and supplied to each model execution scope.
 * Related: src/backend/integrations/llm/execution-context.ts, src/backend/config.ts
 */
import type { ModelCallAdmission } from "@/backend/integrations/llm/execution-context"
import { MAX_MODEL_CONCURRENCY } from "@/shared/settings"

const DEFAULT_MAX_QUEUED = 1024
const DEFAULT_WAIT_TIMEOUT_MS = 120_000

interface WaitingCall {
  resolve: (release: () => void) => void
  dispose: () => void
}

interface ResourcePool {
  active: number
  lastOwner?: string
  owners: Map<string, WaitingCall[]>
}

interface AdmissionOptions {
  concurrency: number
  maxQueued?: number
  waitTimeoutMs?: number
}

export class ModelAdmission implements ModelCallAdmission {
  private readonly pools = new Map<string, ResourcePool>()
  private queued = 0
  private readonly maxQueued: number
  private readonly waitTimeoutMs: number
  private concurrency: number

  constructor(options: AdmissionOptions) {
    this.concurrency = options.concurrency
    this.maxQueued = options.maxQueued ?? DEFAULT_MAX_QUEUED
    this.waitTimeoutMs = options.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS
    for (const value of [options.concurrency, this.maxQueued, this.waitTimeoutMs]) {
      if (!Number.isSafeInteger(value) || value < 1) throw new Error("Model admission limits must be positive integers.")
    }
    if (options.concurrency > MAX_MODEL_CONCURRENCY) throw new Error("Model concurrency exceeds its configured maximum.")
  }

  async acquire(key: string, owner: string, signal?: AbortSignal): Promise<() => void> {
    signal?.throwIfAborted()
    let pool = this.pools.get(key)
    if (!pool) {
      pool = { active: 0, owners: new Map() }
      this.pools.set(key, pool)
    }
    if (pool.active < this.concurrency && !pool.owners.size) return this.grant(key, pool, owner)
    if (this.queued >= this.maxQueued) throw new Error("Model admission queue is full; retry after pending work finishes.")
    const target = pool
    return new Promise((resolve, reject) => {
      const cancel = (reason: unknown) => {
        const queue = target.owners.get(owner)
        const index = queue?.indexOf(waiter) ?? -1
        if (!queue || index < 0) return
        queue.splice(index, 1)
        if (!queue.length) target.owners.delete(owner)
        this.queued--
        waiter.dispose()
        reject(reason)
      }
      const abort = () => cancel(signal?.reason)
      const timeout = setTimeout(() => cancel(new Error("Model admission timed out; reduce active work or raise the configured allowance.")), this.waitTimeoutMs)
      const waiter: WaitingCall = {
        resolve,
        dispose: () => { clearTimeout(timeout); signal?.removeEventListener("abort", abort) },
      }
      const queue = target.owners.get(owner) ?? []
      queue.push(waiter)
      target.owners.set(owner, queue)
      this.queued++
      signal?.addEventListener("abort", abort, { once: true })
      if (signal?.aborted) abort()
    })
  }

  snapshot(): { active: number; waiting: number; pools: number } {
    return { active: [...this.pools.values()].reduce((sum, pool) => sum + pool.active, 0), waiting: this.queued, pools: this.pools.size }
  }

  setConcurrency(value: number): void {
    if (!Number.isSafeInteger(value) || value < 1 || value > MAX_MODEL_CONCURRENCY) {
      throw new Error(`Model concurrency must be between 1 and ${MAX_MODEL_CONCURRENCY}.`)
    }
    this.concurrency = value
    for (const [key, pool] of this.pools) this.drain(key, pool)
  }

  private grant(key: string, pool: ResourcePool, owner: string): () => void {
    pool.active++
    pool.lastOwner = owner
    let released = false
    return () => {
      if (released) return
      released = true
      pool.active--
      this.drain(key, pool)
      if (!pool.active && !pool.owners.size) this.pools.delete(key)
    }
  }

  private drain(key: string, pool: ResourcePool): void {
    while (pool.active < this.concurrency && pool.owners.size) {
      let entry = pool.owners.entries().next().value
      if (!entry) return
      if (entry[0] === pool.lastOwner && pool.owners.size > 1) {
        pool.owners.delete(entry[0])
        pool.owners.set(...entry)
        entry = pool.owners.entries().next().value
        if (!entry) return
      }
      const [owner, queue] = entry
      const waiter = queue.shift()
      pool.owners.delete(owner)
      if (queue.length) pool.owners.set(owner, queue)
      if (!waiter) continue
      this.queued--
      waiter.dispose()
      waiter.resolve(this.grant(key, pool, owner))
    }
  }
}
