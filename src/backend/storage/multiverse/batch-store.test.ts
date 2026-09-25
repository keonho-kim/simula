/**
 * Purpose: Verify stable batch creation and serialized updates to independent world slots.
 * Pattern: Persistence contract test.
 * Usage: bun test src/backend/storage/multiverse/batch-store.test.ts
 * Related: src/backend/storage/multiverse/batch-store.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { multiverseRequestSchema } from "@/shared/multiverse-schema"
import { BatchStore } from "./batch-store"

test("duplicate creates retain exactly 50 world identities and concurrent slot updates do not overwrite siblings", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-batch-store-"))
  try {
    const store = new BatchStore(root)
    const id = crypto.randomUUID()
    const request = multiverseRequestSchema.parse({ scenarioId: crypto.randomUUID(), controls: {}, worldCount: 50 })
    const [first, second] = await Promise.all([store.create(id, request, 1), store.create(id, request, 1)])
    expect(first.worlds.map(world => world.id)).toEqual(second.worlds.map(world => world.id))
    expect(new Set(first.worlds.map(world => world.id)).size).toBe(50)
    const lease = store.execution(id).claim()
    if (!lease) throw new Error("Missing batch owner")
    await Promise.all(first.worlds.map((world, index) => (index % 2 ? store : new BatchStore(root)).update(id, current => ({ ...current,
      worlds: current.worlds.map(value => value.id === world.id ? { ...value, status: "completed" } : value),
    }), lease)))
    lease.release()
    const reopened = await new BatchStore(root).read(id)
    expect(reopened.worlds.every(world => world.status === "completed")).toBe(true)
    await expect(store.create(id, { ...request, worldCount: 5 }, 1)).rejects.toThrow("different")
    await expect(store.read("../outside")).rejects.toThrow()
  } finally { await rm(root, { recursive: true, force: true }) }
})
