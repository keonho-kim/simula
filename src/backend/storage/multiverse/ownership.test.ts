/**
 * Purpose: Verify batch publication rejects displaced and wrong-scope execution leases.
 * Pattern: Storage ownership contract tests.
 * Usage: bun test src/backend/storage/multiverse/ownership.test.ts
 * Related: src/backend/storage/multiverse/batch-store.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { ExecutionOwnership } from "../generation/execution-lease"
import { multiverseRequestSchema } from "@/shared/multiverse-schema"
import { BatchStore } from "./batch-store"

test("a displaced batch supervisor cannot overwrite its successor or release its ownership", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-batch-owner-"))
  try {
    const store = new BatchStore(root)
    const batch = await store.create(crypto.randomUUID(), multiverseRequestSchema.parse({ scenarioId: crypto.randomUUID(), controls: {} }), 1)
    const old = store.execution(batch.id).claim()
    if (!old) throw new Error("Missing batch owner")
    const current = new ExecutionOwnership(join(root, batch.id), () => old.expiresAt + 1).claim()
    if (!current) throw new Error("Missing successor")
    await store.update(batch.id, value => ({ ...value, status: "partial" }), current)
    await expect(store.update(batch.id, value => ({ ...value, status: "completed" }), old)).rejects.toThrow("ownership")
    old.release()
    expect((await store.read(batch.id)).status).toBe("partial")
    expect(store.execution(batch.id).isActive()).toBe(true)
    const other = await store.create(crypto.randomUUID(), batch.request, 1)
    await expect(store.update(other.id, value => value, current)).rejects.toThrow("directory")
    current.requestCancel()
    await expect(store.update(batch.id, value => ({ ...value, status: "completed" }), current)).rejects.toThrow("canceled")
    await store.update(batch.id, value => ({ ...value, status: "canceled" }), current, true)
    expect((await store.read(batch.id)).status).toBe("canceled")
    current.release()
  } finally { await rm(root, { recursive: true, force: true }) }
})
