/**
 * Purpose: Fence one active execution's ownership and artifact publication in a Bun process.
 * Pattern: Process-scoped lease.
 * Usage: Claimed by runtime jobs and passed to their bounded file publications.
 * Related: src/backend/storage/runs/round-approvals.ts, src/backend/runtime/generation/ownership.ts
 */
import { appendFileSync, renameSync } from "node:fs"
import { dirname, resolve } from "node:path"

export const GENERATION_LEASE_MS = 30_000

interface LeaseState { owner: string; generation: number; expiresAt: number; canceled: boolean }
const executions = new Map<string, LeaseState>()

export class GenerationOwnershipLost extends Error {
  constructor() { super("Generation execution ownership was lost."); this.name = "GenerationOwnershipLost" }
}
export class GenerationCanceled extends Error {
  constructor() { super("Generation execution was canceled."); this.name = "GenerationCanceled" }
}

export class ExecutionOwnership {
  private readonly directory: string
  constructor(directory: string, private readonly now: () => number = Date.now) { this.directory = resolve(directory) }

  claim(): ExecutionLease | undefined {
    const previous = executions.get(this.directory)
    const now = this.now()
    if (previous?.owner && previous.expiresAt > now) return undefined
    const state: LeaseState = { owner: crypto.randomUUID(), generation: (previous?.generation ?? 0) + 1,
      expiresAt: now + GENERATION_LEASE_MS, canceled: false }
    executions.set(this.directory, state)
    return new ExecutionLease(this.directory, state, this.now)
  }

  isActive(): boolean {
    const state = executions.get(this.directory)
    return Boolean(state?.owner && state.expiresAt > this.now())
  }

  activeGeneration(): number | undefined {
    const state = executions.get(this.directory)
    return state?.owner && state.expiresAt > this.now() && !state.canceled ? state.generation : undefined
  }

  requestCancel(): boolean {
    const state = executions.get(this.directory)
    if (!state?.owner || state.expiresAt <= this.now()) return false
    executions.set(this.directory, { ...state, canceled: true })
    return true
  }
}

export class ExecutionLease {
  constructor(private readonly directory: string, private state: LeaseState, private readonly now: () => number) {}
  get expiresAt(): number { return this.state.expiresAt }
  get generation(): number { return this.state.generation }

  assertScope(directory: string): void {
    if (resolve(directory) !== this.directory) throw new Error("Execution lease belongs to a different directory.")
  }

  assertActive(): void {
    if (this.assertOwner().canceled) throw new GenerationCanceled()
  }

  renew(): boolean {
    const state = this.assertOwner()
    const next = { ...state, expiresAt: this.now() + GENERATION_LEASE_MS }
    executions.set(this.directory, next)
    this.state = next
    return !state.canceled
  }

  publish(temporary: string, destination: string, allowCanceled = false): void {
    this.assertPaths(temporary, destination)
    this.publishRelatedArtifact(() => { renameSync(temporary, destination); return undefined }, allowCanceled)
  }

  append(path: string, body: string, allowCanceled = false): void {
    this.assertPaths(path)
    this.publishRelatedArtifact(() => { appendFileSync(path, body, "utf8"); return undefined }, allowCanceled)
  }

  requestCancel(): void {
    const state = this.assertOwner()
    executions.set(this.directory, { ...state, canceled: true })
  }

  /** Synchronous publication cannot interleave another claim on the same Bun event loop. */
  publishRelatedArtifact(publication: () => undefined, allowCanceled = false): void {
    const state = this.assertOwner()
    if (state.canceled && !allowCanceled) throw new GenerationCanceled()
    publication()
  }

  release(): void {
    const state = executions.get(this.directory)
    if (state?.owner === this.state.owner && state.generation === this.state.generation) {
      executions.set(this.directory, { ...state, owner: "", expiresAt: 0 })
    }
  }

  private assertPaths(...paths: string[]): void {
    if (paths.some(path => dirname(resolve(path)) !== this.directory)) throw new Error("Generation publication is outside the owned artifact directory.")
  }

  private assertOwner(): LeaseState {
    const state = executions.get(this.directory)
    if (!state || state.owner !== this.state.owner || state.generation !== this.state.generation || state.expiresAt <= this.now()) {
      throw new GenerationOwnershipLost()
    }
    return state
  }
}
