/**
 * Purpose: Own a world's manual approvals and cancellable automatic round countdowns.
 * Pattern: Explicit round progression state machine.
 * Usage: One instance is held for each active batch simulation.
 * Related: src/backend/runtime/multiverse/jobs.ts, src/shared/multiverse.ts
 */
import { AUTOMATIC_ROUND_DELAY_COUNT, AUTOMATIC_ROUND_DELAY_MS, type BatchWorld } from "@/shared/multiverse"

interface RoundClock { now: () => number; schedule: (callback: () => void, delayMs: number) => () => void }
type RoundUpdate = Pick<BatchWorld, "status" | "roundIndex" | "autoContinue" | "automaticStreak" | "continueAt">
interface WaitingRound { index: number; resolve: () => void; reject: (error: unknown) => void }
const systemClock: RoundClock = { now: Date.now, schedule: (callback, delayMs) => {
  const timer = setTimeout(callback, delayMs)
  return () => clearTimeout(timer)
} }

export class ServerRoundProgression {
  private pending?: WaitingRound
  private cancelTimer?: () => void
  private revision = 0
  private streak = 0
  private readonly abort = () => this.fail(this.signal.reason)
  get waitingRound(): number | undefined { return this.pending?.index }

  constructor(private automatic: boolean, private readonly signal: AbortSignal,
    private readonly publish: (update: RoundUpdate) => Promise<void>, private readonly clock: RoundClock = systemClock) {
    signal.addEventListener("abort", this.abort, { once: true })
  }

  wait(index: number): Promise<void> {
    this.signal.throwIfAborted()
    if (this.pending) return Promise.reject(new Error("A world already has a waiting round."))
    const promise = new Promise<void>((resolve, reject) => { this.pending = { index, resolve, reject } })
    void this.schedule().catch(error => this.fail(error))
    return promise
  }

  async setAutomatic(enabled: boolean): Promise<void> {
    this.signal.throwIfAborted()
    if (this.automatic === enabled) return
    this.stopTimer()
    this.automatic = enabled
    if (!enabled) this.streak = 0
    if (this.pending) await this.schedule()
    else await this.publish(this.update("running"))
  }

  async continue(index: number): Promise<void> {
    if (this.pending?.index !== index) throw new Error("Approve only this world's current waiting round.")
    await this.advance(false)
  }

  dispose(): void {
    this.signal.removeEventListener("abort", this.abort)
    this.fail(new Error("World execution ended."))
  }

  private async schedule(): Promise<void> {
    this.stopTimer()
    const version = this.revision
    const wait = this.pending
    if (!wait) return
    const skip = this.automatic && this.streak >= AUTOMATIC_ROUND_DELAY_COUNT
    const continueAt = this.automatic && !skip ? new Date(this.clock.now() + AUTOMATIC_ROUND_DELAY_MS).toISOString() : undefined
    await this.publish({ ...this.update("waiting"), roundIndex: wait.index, continueAt })
    if (this.signal.aborted || version !== this.revision || this.pending !== wait) return
    if (skip) { await this.advance(true); return }
    if (this.automatic) this.cancelTimer = this.clock.schedule(() => {
      if (version === this.revision && this.automatic && this.pending === wait) void this.advance(true).catch(error => this.fail(error))
    }, AUTOMATIC_ROUND_DELAY_MS)
  }

  private async advance(automatic: boolean): Promise<void> {
    const wait = this.pending
    if (!wait) return
    this.stopTimer()
    this.pending = undefined
    this.streak = automatic ? Math.min(AUTOMATIC_ROUND_DELAY_COUNT, this.streak + 1) : 0
    try { this.signal.throwIfAborted(); await this.publish({ ...this.update("running"), roundIndex: wait.index }); wait.resolve() }
    catch (error) { wait.reject(error); throw error }
  }

  private update(status: "running" | "waiting"): RoundUpdate {
    return { status, autoContinue: this.automatic, automaticStreak: this.streak, continueAt: undefined }
  }
  private stopTimer(): void { this.revision++; this.cancelTimer?.(); this.cancelTimer = undefined }
  private fail(error: unknown): void { this.stopTimer(); this.pending?.reject(error); this.pending = undefined }
}
