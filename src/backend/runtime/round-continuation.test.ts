/**
 * Purpose: Verify local approval notification and wait cleanup on cancellation or ownership loss.
 * Pattern: Runtime lifecycle contract tests.
 * Usage: bun test src/backend/runtime/round-continuation.test.ts
 * Related: src/backend/runtime/round-continuation.ts, src/backend/storage/runs/round-approvals.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ExecutionOwnership } from "@/backend/storage/generation/execution-lease"
import { RoundApprovals } from "@/backend/storage/runs/round-approvals"
import { RoundContinuationStore } from "./round-continuation"

test("a waiting run observes an approval notification in the owning process", async () => {
  const directory = await mkdtemp(join(tmpdir(), "simula-remote-round-"))
  const waits = new RoundContinuationStore()
  const lease = new ExecutionOwnership(directory).claim()
  if (!lease) throw new Error("Missing owner")
  let pending: Promise<void> | undefined
  try {
    const approvals = new RoundApprovals(directory)
    pending = waits.wait("run", 1, approvals, lease)
    expect(new RoundApprovals(directory).approve(1)).toBe(true)
    waits.notify("run")
    await pending
    expect(approvals.consume(1, lease)).toBe(false)
    const next = waits.wait("run", 2, approvals, lease)
    waits.clearRun("run")
    await expect(next).rejects.toThrow("canceled")
    expect(approvals.consume(2, lease)).toBe(false)
  } finally { waits.clearRun("run"); await pending?.catch(() => {}); lease.release(); await rm(directory, { recursive: true, force: true }) }
})

test("a displaced round waiter rejects without consuming the successor's approval", async () => {
  const directory = await mkdtemp(join(tmpdir(), "simula-displaced-round-"))
  const waits = new RoundContinuationStore()
  let now = Date.now()
  const ownership = new ExecutionOwnership(directory, () => now)
  const lease = ownership.claim()
  if (!lease) throw new Error("Missing owner")
  try {
    const approvals = new RoundApprovals(directory, () => now)
    const pending = waits.wait("run", 1, approvals, lease)
    now = lease.expiresAt + 1
    const current = ownership.claim()
    if (!current) throw new Error("Missing successor")
    approvals.open(1, current)
    expect(approvals.approve(1)).toBe(true)
    waits.notify("run")
    await expect(pending).rejects.toThrow("ownership")
    expect(approvals.consume(1, current)).toBe(true)
    current.release()
  } finally { waits.clearRun("run"); lease.release(); await rm(directory, { recursive: true, force: true }) }
})
