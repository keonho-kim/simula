/**
 * Purpose: Verify batch world counts, isolation, idempotency, partial failure, and scoped cancellation.
 * Pattern: End-to-end backend workflow tests with deterministic models.
 * Usage: bun test src/backend/runtime/multiverse/jobs.test.ts
 * Related: src/backend/runtime/multiverse/jobs.ts, src/backend/runtime/multiverse/test-fixtures.ts
 */
import { expect, spyOn, test } from "bun:test"
import { multiverseRequestSchema } from "@/shared/multiverse-schema"
import { currentModelExecution } from "@/backend/integrations/llm/execution-context"
import { batchFixture } from "./test-fixtures"

for (const count of [1, 5, 50]) test(`${count} worlds independently prepare and complete without browser approvals`, async () => {
  const f = await batchFixture()
  try {
    const id = crypto.randomUUID()
    const input = multiverseRequestSchema.parse({ scenarioId: f.source.id, worldCount: count, controls: { maxRound: 1, actionsPerType: 1, fastMode: true } })
    const batch = await f.jobs.create(id, input)
    const completion = f.jobs.start(id)
    expect(f.jobs.start(id)).toBe(completion)
    expect((await f.jobs.create(id, input)).worlds.map(world => world.id)).toEqual(batch.worlds.map(world => world.id))
    await completion
    const final = await f.jobs.read(id)
    expect(final.status).toBe("completed")
    expect(final.worlds).toHaveLength(count)
    expect(f.calls.filter(call => call.id === "opening-setting")).toHaveLength(count)
    for (const world of final.worlds) {
      expect(world.status).toBe("completed")
      const state = await f.runs.readState(world.runId!)
      expect(state?.scenario.world?.id).toBe(world.id)
      expect(state?.scenario.world?.sourceScenarioId).toBe(f.source.id)
      expect(state?.actors.map(actor => actor.name)).toEqual(["CTO", "Finance"])
      expect(state?.roundReports).toHaveLength(1)
      const events = await f.runs.readEvents(world.runId!)
      expect(events.every(event => event.runId === world.runId)).toBe(true)
      expect(events.some(event => event.type === "model.metrics" && event.metrics.step === "reportCommentary")).toBe(false)
    }
    expect((await f.scenarios.read(f.source.id)).specification).toEqual(f.source)
    const callsBefore = f.calls.length
    await f.jobs.start(id)
    expect(f.calls.length).toBe(callsBefore)
    expect(f.runningRuns.size).toBe(0)
    expect(f.admission.snapshot().active).toBe(0)
  } finally { await f.close() }
}, 60_000)

test("one failed preparation preserves the other completed worlds and can retry only its units", async () => {
  let failedWorld: string | undefined
  const f = await batchFixture(async call => {
    if (call.id === "opening-setting" && currentModelExecution()?.owner === failedWorld) throw new Error("Controlled provider failure")
  })
  try {
    const batch = await f.jobs.create(crypto.randomUUID(), multiverseRequestSchema.parse({ scenarioId: f.source.id, worldCount: 3, controls: { maxRound: 1, actionsPerType: 1 } }))
    failedWorld = batch.worlds[0].id
    await f.jobs.start(batch.id)
    const partial = await f.jobs.read(batch.id)
    expect(partial.status).toBe("partial")
    expect(partial.worlds.map(world => world.status)).toEqual(["failed", "completed", "completed"])
    const completedIds = partial.worlds.slice(1).map(world => world.runId)
    failedWorld = undefined
    await f.jobs.start(batch.id)
    expect((await f.jobs.read(batch.id)).status).toBe("completed")
    expect((await f.jobs.read(batch.id)).worlds.slice(1).map(world => world.runId)).toEqual(completedIds)
    expect(f.calls.filter(call => call.id === "opening-setting")).toHaveLength(3)
  } finally { await f.close() }
}, 30_000)

test("manual approval advances only the selected world's waiting round", async () => {
  const f = await batchFixture()
  const waiting = Promise.withResolvers<void>()
  const firstDone = Promise.withResolvers<void>()
  const update = f.jobs.store.update.bind(f.jobs.store)
  const observe = spyOn(f.jobs.store, "update").mockImplementation(async (...args) => {
    const record = await update(...args)
    if (record.worlds.every(world => world.status === "waiting")) waiting.resolve()
    if (record.worlds[0]?.status === "completed") firstDone.resolve()
    return record
  })
  let completion: Promise<void> | undefined
  let id: string | undefined
  try {
    const batch = await f.jobs.create(crypto.randomUUID(), multiverseRequestSchema.parse({ scenarioId: f.source.id, worldCount: 2,
      autoContinue: false, controls: { maxRound: 2, actionsPerType: 1 } }))
    id = batch.id
    completion = f.jobs.start(batch.id)
    await waiting.promise
    await expect(f.jobs.continue(batch.id, batch.worlds[0].id, 2)).rejects.toThrow("waiting round")
    await f.jobs.continue(batch.id, batch.worlds[0].id, 1)
    await firstDone.promise
    expect((await f.jobs.read(batch.id)).worlds[1].status).toBe("waiting")
    await f.jobs.cancel(batch.id, batch.worlds[1].id)
    await completion
    expect((await f.jobs.read(batch.id)).worlds.map(world => world.status)).toEqual(["completed", "canceled"])
  } finally { if (id) await f.jobs.cancel(id); await completion; observe.mockRestore(); await f.close() }
}, 30_000)

test("expired execution budget stops pending worlds without generating a replacement scenario", async () => {
  const f = await batchFixture()
  try {
    const batch = await f.jobs.create(crypto.randomUUID(), multiverseRequestSchema.parse({ scenarioId: f.source.id, worldCount: 5, controls: {} }))
    const lease = f.jobs.store.execution(batch.id).claim()
    if (!lease) throw new Error("Missing batch owner")
    await f.jobs.store.update(batch.id, current => ({ ...current, deadlineAt: new Date(0).toISOString() }), lease)
    lease.release()
    await f.jobs.start(batch.id)
    const final = await f.jobs.read(batch.id)
    expect(final.status).toBe("canceled")
    expect(final.stopReason).toBe("deadline")
    expect(final.worlds.every(world => world.status === "canceled")).toBe(true)
    expect(f.calls).toHaveLength(0)
  } finally { await f.close() }
})

test("canceling one preparing world does not cancel sibling worlds or the batch join", async () => {
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  let heldWorld: string | undefined
  const f = await batchFixture(async call => {
    if (call.id === "opening-setting" && currentModelExecution()?.owner === heldWorld) { entered.resolve(); await release.promise }
  })
  try {
    const batch = await f.jobs.create(crypto.randomUUID(), multiverseRequestSchema.parse({ scenarioId: f.source.id, worldCount: 3, controls: { maxRound: 1, actionsPerType: 1 } }))
    heldWorld = batch.worlds[0].id
    const completion = f.jobs.start(batch.id)
    await entered.promise
    await f.jobs.cancel(batch.id, heldWorld)
    release.resolve()
    await completion
    const final = await f.jobs.read(batch.id)
    expect(final.status).toBe("partial")
    expect(final.worlds.map(world => world.status)).toEqual(["canceled", "completed", "completed"])
    expect(f.runningRuns.size).toBe(0)
  } finally { release.resolve(); await f.close() }
}, 30_000)
