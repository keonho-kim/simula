/**
 * Purpose: Verify round approvals are scoped, durable, idempotent, and fenced by execution generation.
 * Pattern: Repository contract tests.
 * Usage: bun test src/backend/storage/runs/round-approvals.test.ts
 * Related: src/backend/storage/runs/round-approvals.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ExecutionOwnership } from "../generation/execution-lease"
import { RoundApprovals } from "./round-approvals"

test("only the opened round can be approved, duplicate approval never advances another round", async () => {
  const directory = await mkdtemp(join(tmpdir(), "simula-round-gate-"))
  try {
    const gates = new RoundApprovals(directory)
    expect(gates.approve(1)).toBe(false)
    const lease = new ExecutionOwnership(directory).claim()
    if (!lease) throw new Error("Missing owner")
    expect(gates.approve(1)).toBe(false)
    gates.open(1, lease)
    expect(gates.approve(2)).toBe(false)
    expect(gates.consume(1, lease)).toBe(false)
    expect(new RoundApprovals(directory).approve(1)).toBe(true)
    gates.open(1, lease) // Event publication and wait registration may both open this gate.
    expect(gates.consume(1, lease)).toBe(true)
    expect(gates.consume(1, lease)).toBe(false)
    expect(gates.approve(1)).toBe(true)
    expect(() => gates.open(1, lease)).toThrow("consumed")
    gates.open(2, lease)
    expect(gates.approve(1)).toBe(true)
    expect(gates.consume(2, lease)).toBe(false)
    expect(() => gates.open(3, lease)).toThrow("waiting")
    lease.release()
    expect(gates.approve(2)).toBe(false)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test("canceled, expired, wrong-scope and predecessor approvals cannot advance the current owner", async () => {
  const directory = await mkdtemp(join(tmpdir(), "simula-round-fence-"))
  const other = await mkdtemp(join(tmpdir(), "simula-round-other-"))
  let now = Date.now()
  try {
    const ownership = new ExecutionOwnership(directory, () => now)
    const gates = new RoundApprovals(directory, () => now)
    const old = ownership.claim()
    const unrelated = new ExecutionOwnership(other).claim()
    if (!old || !unrelated) throw new Error("Missing owner")
    expect(() => gates.open(1, unrelated)).toThrow("directory")
    gates.open(1, old)
    expect(gates.approve(1)).toBe(true)
    now = old.expiresAt + 1
    expect(gates.approve(1)).toBe(false)
    const current = ownership.claim()
    if (!current) throw new Error("Missing successor")
    expect(gates.approve(1)).toBe(false)
    expect(() => gates.consume(1, old)).toThrow("ownership")
    gates.open(1, current)
    expect(gates.consume(1, current)).toBe(false)
    ownership.requestCancel()
    expect(gates.approve(1)).toBe(false)
    expect(() => gates.consume(1, current)).toThrow("canceled")
    current.release(); unrelated.release()
  } finally {
    await rm(directory, { recursive: true, force: true })
    await rm(other, { recursive: true, force: true })
  }
})
