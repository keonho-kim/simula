/**
 * Purpose: Verify batch supervisors share ownership, read active peers, and propagate remote cancellation.
 * Pattern: Runtime concurrency tests with controlled model work.
 * Usage: bun test src/backend/runtime/multiverse/ownership.test.ts
 * Related: src/backend/runtime/multiverse/jobs.ts, src/backend/storage/multiverse/batch-store.ts
 */
import { expect, spyOn, test } from "bun:test"
import { join } from "node:path"
import { BatchStore } from "@/backend/storage/multiverse/batch-store"
import { ExecutionOwnership } from "@/backend/storage/generation/execution-lease"
import { multiverseRequestSchema } from "@/shared/multiverse-schema"
import { MultiverseJobs } from "./jobs"
import { batchFixture } from "./test-fixtures"

test("a competing supervisor neither restarts worlds nor reports a live batch as interrupted", async () => {
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  const f = await batchFixture(async call => { if (call.id === "opening-setting") { entered.resolve(); await release.promise } })
  let work: Promise<void> | undefined
  try {
    const batch = await f.jobs.create(crypto.randomUUID(), multiverseRequestSchema.parse({ scenarioId: f.source.id, worldCount: 1, controls: { maxRound: 1, actionsPerType: 1 } }))
    work = f.jobs.start(batch.id)
    await entered.promise
    const peer = new MultiverseJobs(new BatchStore(f.jobs.store.rootDir), { ...f.runtime,
      getSettings: async () => { throw new Error("A competing supervisor must not load settings") } })
    expect((await peer.read(batch.id)).status).toBe("running")
    await peer.start(batch.id)
    expect((await peer.read(batch.id)).worlds[0]?.status).toBe("preparing")
    release.resolve(); await work
    expect((await peer.read(batch.id)).status).toBe("completed")
    expect(f.calls.filter(call => call.id === "opening-setting")).toHaveLength(1)
    expect(f.jobs.store.execution(batch.id).isActive()).toBe(false)
  } finally { release.resolve(); await work; await f.close() }
})

test("another supervisor's full cancellation reaches active preparation and stops new model work", async () => {
  const entered = Promise.withResolvers<void>()
  const f = await batchFixture(async (call, signal) => {
    if (call.id !== "opening-setting") return
    entered.resolve()
    await new Promise<void>((_resolve, reject) => {
      if (signal.aborted) reject(signal.reason)
      else signal.addEventListener("abort", () => reject(signal.reason), { once: true })
    })
  })
  let id: string | undefined, work: Promise<void> | undefined
  try {
    const batch = await f.jobs.create(crypto.randomUUID(), multiverseRequestSchema.parse({ scenarioId: f.source.id, worldCount: 1, controls: {} }))
    id = batch.id
    work = f.jobs.start(id)
    await entered.promise
    const peer = new MultiverseJobs(new BatchStore(f.jobs.store.rootDir), f.runtime)
    await peer.cancel(id)
    await work
    const final = await peer.read(id)
    expect(final.status).toBe("canceled")
    expect(final.stopReason).toBe("user")
    expect(final.worlds[0]?.status).toBe("canceled")
    expect((await f.worlds.store.read(batch.worlds[0]!.id)).status).toBe("canceled")
    expect(f.calls).toHaveLength(0)
    expect(f.jobs.store.execution(id).isActive()).toBe(false)
  } finally { if (id && f.jobs.store.execution(id).isActive()) await f.jobs.cancel(id); await work; await f.close() }
}, 10_000)

test("late batch work cannot replace a successor's record after ownership expires", async () => {
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  const f = await batchFixture(async call => { if (call.id === "opening-setting") { entered.resolve(); await release.promise } })
  let work: Promise<void> | undefined
  try {
    const batch = await f.jobs.create(crypto.randomUUID(), multiverseRequestSchema.parse({ scenarioId: f.source.id, worldCount: 1, controls: {} }))
    work = f.jobs.start(batch.id)
    await entered.promise
    const successor = new ExecutionOwnership(join(f.jobs.store.rootDir, batch.id), () => Date.now() + 60_000).claim()
    if (!successor) throw new Error("Missing successor")
    const current = await f.jobs.store.update(batch.id, record => ({ ...record, status: "partial",
      worlds: record.worlds.map(world => ({ ...world, status: "interrupted", issue: "Successor record" })),
    }), successor)
    release.resolve(); await work
    expect(await f.jobs.store.read(batch.id)).toEqual(current)
    expect(successor.renew()).toBe(true)
    expect((await f.worlds.store.readTask(batch.worlds[0]!.id, "opening"))).toBeUndefined()
    successor.release()
  } finally { release.resolve(); await work; await f.close() }
})

test("remote batch cancellation wakes manual simulation waits and preserves canceled run history", async () => {
  const f = await batchFixture()
  const waiting = Promise.withResolvers<void>()
  const update = f.jobs.store.update.bind(f.jobs.store)
  const observe = spyOn(f.jobs.store, "update").mockImplementation(async (...args) => {
    const record = await update(...args)
    if (record.worlds[0]?.status === "waiting") waiting.resolve()
    return record
  })
  let id: string | undefined, work: Promise<void> | undefined
  try {
    const batch = await f.jobs.create(crypto.randomUUID(), multiverseRequestSchema.parse({ scenarioId: f.source.id,
      worldCount: 1, autoContinue: false, controls: { maxRound: 2, actionsPerType: 1 } }))
    id = batch.id
    work = f.jobs.start(id)
    await waiting.promise
    const peer = new MultiverseJobs(new BatchStore(f.jobs.store.rootDir), f.runtime)
    await peer.cancel(id)
    await work
    const final = await peer.read(id)
    expect(final.status).toBe("canceled")
    const world = final.worlds[0]
    if (!world?.runId) throw new Error("Missing world run")
    expect(world.status).toBe("canceled")
    expect((await f.runs.readManifest(world.runId)).status).toBe("canceled")
    expect((await f.runs.readEvents(world.runId)).some(event => event.type === "run.canceled")).toBe(true)
    expect(f.runningRuns.size).toBe(0)
  } finally { if (id && f.jobs.store.execution(id).isActive()) await f.jobs.cancel(id); await work; observe.mockRestore(); await f.close() }
}, 10_000)
