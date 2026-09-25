/**
 * Purpose: Verify process-scoped ownership and fencing of expired publications.
 * Pattern: Execution lifecycle contract tests.
 * Usage: bun test src/backend/storage/generation/execution-lease.test.ts
 * Related: src/backend/storage/generation/execution-lease.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ExecutionOwnership } from "./execution-lease"

test("lease replacement rejects late publication and late release cannot unlock the new owner", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-lease-"))
  let now = 1000
  try {
    const first = new ExecutionOwnership(root, () => now)
    const second = new ExecutionOwnership(root, () => now)
    const old = first.claim()
    if (!old) throw new Error("Missing first claim")
    expect(second.claim()).toBeUndefined()
    const pending = join(root, "old.tmp")
    const accepted = join(root, "task.json")
    await writeFile(pending, "old result")
    now = old.expiresAt + 1
    const current = second.claim()
    if (!current) throw new Error("Missing replacement claim")
    expect(() => old.publish(pending, accepted)).toThrow("ownership")
    old.release()
    expect(second.isActive()).toBe(true)
    const next = join(root, "new.tmp")
    await writeFile(next, "new result")
    current.publish(next, accepted)
    expect(await readFile(accepted, "utf8")).toBe("new result")
    current.release()
    expect(first.isActive()).toBe(false)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("persisted cancellation forbids accepting tasks but permits a canceled terminal manifest", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-lease-cancel-"))
  try {
    const ownership = new ExecutionOwnership(root)
    const lease = ownership.claim()
    if (!lease) throw new Error("Missing claim")
    expect(new ExecutionOwnership(root).requestCancel()).toBe(true)
    expect(lease.renew()).toBe(false)
    const temporary = join(root, "pending.tmp")
    await writeFile(temporary, "canceled")
    expect(() => lease.publish(temporary, join(root, "task.json"))).toThrow("canceled")
    lease.publish(temporary, join(root, "manifest.json"), true)
    lease.release()
    expect(ownership.requestCancel()).toBe(false)
  } finally { await rm(root, { recursive: true, force: true }) }
})
