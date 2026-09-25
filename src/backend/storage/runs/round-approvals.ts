/**
 * Purpose: Approve only the active execution's currently waiting round in one Bun process.
 * Pattern: Process-scoped state machine.
 * Usage: Run execution opens/consumes gates; API controllers approve the current gate.
 * Related: src/backend/storage/generation/execution-lease.ts, src/backend/runtime/round-continuation.ts
 */
import { resolve } from "node:path"
import { ExecutionOwnership, type ExecutionLease } from "../generation/execution-lease"

interface Gate { generation: number; roundIndex: number; approved: boolean; consumedThrough: number }
const gates = new Map<string, Gate>()

export class RoundApprovals {
  private readonly directory: string
  private readonly ownership: ExecutionOwnership
  constructor(directory: string, now: () => number = Date.now) {
    this.directory = resolve(directory)
    this.ownership = new ExecutionOwnership(this.directory, now)
  }

  open(roundIndex: number, lease: ExecutionLease): void {
    assertRound(roundIndex)
    lease.assertScope(this.directory)
    lease.assertActive()
    const previous = gates.get(this.directory)
    const sameGeneration = previous?.generation === lease.generation
    const consumedThrough = sameGeneration ? previous.consumedThrough : 0
    if (roundIndex <= consumedThrough) throw new Error("Round approval was already consumed.")
    if (sameGeneration && previous.roundIndex > consumedThrough) {
      if (previous.roundIndex === roundIndex) return
      throw new Error("Another round is still waiting for approval.")
    }
    gates.set(this.directory, { generation: lease.generation, roundIndex, approved: false, consumedThrough })
  }

  approve(roundIndex: number): boolean {
    assertRound(roundIndex)
    const generation = this.ownership.activeGeneration()
    const gate = gates.get(this.directory)
    if (!gate || generation !== gate.generation) return false
    if (roundIndex <= gate.consumedThrough) return true
    if (roundIndex !== gate.roundIndex) return false
    gates.set(this.directory, { ...gate, approved: true })
    return true
  }

  consume(roundIndex: number, lease: ExecutionLease): boolean {
    assertRound(roundIndex)
    lease.assertScope(this.directory)
    lease.assertActive()
    const gate = gates.get(this.directory)
    if (!gate || gate.generation !== lease.generation || gate.roundIndex !== roundIndex
      || !gate.approved || gate.consumedThrough >= roundIndex) return false
    gates.set(this.directory, { ...gate, consumedThrough: roundIndex })
    return true
  }
}

function assertRound(roundIndex: number): void {
  if (!Number.isSafeInteger(roundIndex) || roundIndex < 1) throw new Error("roundIndex must be a positive safe integer.")
}
