/**
 * Purpose: Supervise concurrent independent worlds, batch deadlines, and scoped user controls.
 * Pattern: Batch lifecycle state machine.
 * Usage: Composed once by the server and called through the Multiverse API.
 * Related: src/backend/runtime/multiverse/world-execution.ts, src/backend/storage/multiverse/batch-store.ts
 */
import { BatchControlDelivery } from "./controls"
import { GenerationCanceled, GenerationOwnershipLost, type ExecutionLease } from "@/backend/storage/generation/execution-lease"
import { publishGenerationFailure, runWithGenerationLease } from "../generation/ownership"
import type { BatchWorld, MultiverseRecord, MultiverseRequest } from "@/shared/multiverse"
import type { BatchStore } from "@/backend/storage/multiverse/batch-store"
import { executeBatchWorld, type ActiveBatch, type BatchExecutionDependencies } from "./world-execution"

const TERMINAL_WORLD_STATUSES = new Set<BatchWorld["status"]>(["completed", "failed", "canceled", "interrupted"])

export class MultiverseJobs {
  private readonly active = new Map<string, ActiveBatch>()
  constructor(readonly store: BatchStore, private readonly dependencies: BatchExecutionDependencies) {}

  async create(id: string, request: MultiverseRequest): Promise<MultiverseRecord> {
    const source = await this.dependencies.worlds.source({ scenarioId: request.scenarioId, controls: request.controls })
    return this.store.create(id, request, source.version)
  }

  start(id: string): Promise<void> {
    const previous = this.active.get(id)
    if (previous) return previous.completion
    const lease = this.store.execution(id).claim()
    if (!lease) return Promise.resolve()
    const job: ActiveBatch = { lease, controller: new AbortController(), canceled: new Set(), rounds: new Map(), runIds: new Map(), completion: Promise.resolve() }
    this.active.set(id, job)
    job.completion = runWithGenerationLease(lease, job.controller, () => this.execute(id, job))
      .finally(() => { job.controller.abort(new Error("Batch execution ended.")); this.active.delete(id) })
    return job.completion
  }

  async read(id: string): Promise<MultiverseRecord> {
    const record = await this.store.read(id)
    if (record.status !== "running" || this.store.execution(id).isActive()) return record
    return { ...record, status: "interrupted", worlds: record.worlds.map(world => TERMINAL_WORLD_STATUSES.has(world.status)
      ? world : { ...world, status: "interrupted", continueAt: undefined }) }
  }

  async cancel(id: string, worldId?: string, reason: "user" | "deadline" = "user"): Promise<void> {
    const record = await this.store.read(id)
    if (worldId && !record.worlds.some(world => world.id === worldId)) throw new Error("World does not belong to this batch.")
    if (record.worlds.every(world => TERMINAL_WORLD_STATUSES.has(world.status))) return
    const job = this.active.get(id)
    if (worldId && this.store.execution(id).isActive()) {
      this.store.commands(id).enqueue(worldId, { kind: "cancel" })
      await job?.wakeControls?.()
      return
    }
    if (job && !worldId) {
      job.stopReason = reason
      job.lease.requestCancel()
      job.controller.abort(new GenerationCanceled())
      return
    }
    if (!worldId && this.store.execution(id).requestCancel()) return
    const lease = this.store.execution(id).claim()
    if (!lease) throw new Error("Batch ownership changed; retry cancellation.")
    try {
      const current = await this.store.read(id)
      for (const world of current.worlds) {
        if ((worldId && world.id !== worldId) || TERMINAL_WORLD_STATUSES.has(world.status)) continue
        this.dependencies.worlds.cancel(world.id)
        if (world.runId) this.dependencies.runs.execution(world.runId).requestCancel()
      }
      await this.store.update(id, value => ({ ...value,
        ...(!worldId ? { status: "canceled" as const, stopReason: reason } : {}),
        worlds: value.worlds.map(world => (worldId && world.id !== worldId) || TERMINAL_WORLD_STATUSES.has(world.status)
          ? world : { ...world, status: "canceled", continueAt: undefined }),
      }), lease)
    } finally { lease.release() }
  }

  async automatic(id: string, worldId: string, enabled: boolean): Promise<void> {
    this.store.commands(id).enqueue(worldId, { kind: "automatic", enabled })
    await this.active.get(id)?.wakeControls?.()
  }

  async continue(id: string, worldId: string, roundIndex: number): Promise<void> {
    this.store.commands(id).enqueue(worldId, { kind: "continue", roundIndex })
    await this.active.get(id)?.wakeControls?.()
  }

  private async execute(id: string, job: ActiveBatch): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined
    let delivery: BatchControlDelivery | undefined
    try {
      const initial = await this.store.read(id)
      if (initial.status === "completed" || initial.status === "canceled") return
      job.lease.assertActive()
      delivery = new BatchControlDelivery(id, this.store, job, this.dependencies, (worldId, patch) => this.updateWorld(id, worldId, patch, job.lease))
      job.wakeControls = delivery.flush.bind(delivery)
      const source = await this.dependencies.worlds.source({ scenarioId: initial.request.scenarioId, controls: initial.request.controls })
      if (source.version !== initial.sourceScenarioVersion) throw new Error("Confirmed scenario revision changed.")
      const settings = await this.dependencies.getSettings()
      job.lease.assertActive()
      await this.store.update(id, current => ({ ...current, status: "running" }), job.lease)
      const remaining = Date.parse(initial.deadlineAt) - Date.now()
      const expire = () => {
        if (job.controller.signal.aborted) return
        try {
          job.lease.assertActive()
          job.stopReason = "deadline"
          job.lease.requestCancel()
          job.controller.abort(new GenerationCanceled())
        }
        catch (error) { job.controller.abort(error) }
      }
      if (remaining > 0) timer = setTimeout(expire, remaining)
      else expire()
      const results = await Promise.allSettled(initial.worlds.map(world => executeBatchWorld(initial, world, job, this.store,
        this.dependencies, settings, (worldId, patch) => this.updateWorld(id, worldId, patch, job.lease))))
      if (results.some(result => result.status === "rejected")) throw new Error("Batch progress could not be persisted.")
      job.controller.signal.throwIfAborted()
      job.lease.assertActive()
      await this.store.update(id, current => ({ ...current,
        status: current.worlds.every(world => world.status === "completed") ? "completed" : "partial",
        stopReason: undefined,
      }), job.lease)
    } catch (error) {
      const deliveryFailure = job.controlFailure !== undefined && !(job.controlFailure instanceof GenerationCanceled) && !(job.controlFailure instanceof GenerationOwnershipLost)
      await publishGenerationFailure(error, job.controller.signal, async canceled => {
        if (deliveryFailure) canceled = false
        await this.store.update(id, current => ({ ...current,
          status: canceled ? "canceled" : "interrupted", stopReason: canceled ? job.stopReason ?? "user" : undefined,
          worlds: current.worlds.map(world => TERMINAL_WORLD_STATUSES.has(world.status) ? world : {
            ...world, status: canceled ? "canceled" : "interrupted", continueAt: undefined,
          }),
        }), job.lease, canceled)
      })
    } finally {
      if (timer) clearTimeout(timer)
      job.wakeControls = undefined
      await delivery?.close()
    }
  }

  private async updateWorld(id: string, worldId: string, patch: Partial<BatchWorld>, lease: ExecutionLease): Promise<void> {
    await this.store.update(id, current => ({ ...current,
      worlds: current.worlds.map(world => world.id === worldId ? { ...world, ...patch } : world),
    }), lease, patch.status !== undefined && TERMINAL_WORLD_STATUSES.has(patch.status))
  }
}
