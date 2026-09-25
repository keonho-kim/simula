/**
 * Purpose: Deliver persisted world controls in order to the current batch supervisor.
 * Pattern: Scoped command consumer.
 * Usage: Owned and disposed by MultiverseJobs for one execution lease.
 * Related: src/backend/storage/multiverse/world-commands.ts, src/backend/runtime/multiverse/rounds.ts
 */
import type { BatchStore } from "@/backend/storage/multiverse/batch-store"
import type { WorldCommand } from "@/backend/storage/multiverse/world-commands"
import type { ActiveBatch, BatchExecutionDependencies, UpdateBatchWorld } from "./world-execution"

const COMMAND_POLL_MS = 250

export class BatchControlDelivery {
  private pending?: Promise<void>
  private closed = false
  private readonly timer: ReturnType<typeof setInterval>
  private readonly abort = () => { this.closed = true; clearInterval(this.timer) }

  constructor(private readonly id: string, private readonly store: BatchStore, private readonly job: ActiveBatch,
    private readonly dependencies: BatchExecutionDependencies, private readonly update: UpdateBatchWorld) {
    this.timer = setInterval(() => { void this.flush().catch(() => undefined) }, COMMAND_POLL_MS)
    job.controller.signal.addEventListener("abort", this.abort, { once: true })
    if (job.controller.signal.aborted) this.abort()
  }

  flush(): Promise<void> {
    if (this.closed) return Promise.resolve()
    if (this.pending) return this.pending
    const work = this.drain().catch(error => {
      this.job.controlFailure = error
      this.job.controller.abort(error)
      throw error
    }).finally(() => { if (this.pending === work) this.pending = undefined })
    this.pending = work
    return work
  }

  async close(): Promise<void> {
    this.abort()
    this.job.controller.signal.removeEventListener("abort", this.abort)
    // Failures already abort the parent; disposal must still finish before releasing its lease.
    await this.pending?.catch(() => undefined)
  }

  private async drain(): Promise<void> {
    const inbox = this.store.commands(this.id)
    while (!this.closed) {
      const commands = inbox.pending(this.job.lease)
      if (!commands.length) return
      for (const command of commands) {
        if (this.closed) return
        this.job.lease.assertActive()
        await this.apply(command)
        inbox.acknowledge(command.id, this.job.lease)
      }
    }
  }

  private async apply(command: WorldCommand): Promise<void> {
    const world = (await this.store.read(this.id)).worlds.find(value => value.id === command.worldId)
    this.job.lease.assertActive()
    if (!world) throw new Error("Stored command belongs to an unknown world.")
    if (["completed", "failed", "canceled", "interrupted"].includes(world.status)) return
    const rounds = this.job.rounds.get(world.id)
    if (command.input.kind === "cancel") {
      this.job.canceled.add(world.id)
      this.dependencies.worlds.cancel(world.id)
      const runId = this.job.runIds.get(world.id) ?? world.runId
      if (runId) this.dependencies.continuations.cancel(runId)
    } else if (command.input.kind === "automatic") {
      if (rounds) await rounds.setAutomatic(command.input.enabled)
      else await this.update(world.id, { autoContinue: command.input.enabled, ...(!command.input.enabled ? { automaticStreak: 0 } : {}) })
    } else if (rounds?.waitingRound === command.input.roundIndex) {
      await rounds.continue(command.input.roundIndex)
    }
    // A timer or an earlier delivery may already have advanced the approved round.
    // Its receipt is acknowledged without advancing any subsequent round.
  }
}
