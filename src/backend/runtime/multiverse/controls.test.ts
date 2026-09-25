/**
 * Purpose: Verify remote ordered world commands affect only their target and preserve exact round approvals.
 * Pattern: Batch control integration tests.
 * Usage: bun test src/backend/runtime/multiverse/controls.test.ts
 * Related: src/backend/runtime/multiverse/controls.ts, src/backend/storage/multiverse/world-commands.ts
 */
import { expect, spyOn, test } from "bun:test"
import { currentModelExecution } from "@/backend/integrations/llm/execution-context"
import { routeMultiverse } from "@/backend/api/multiverse/multiverse-controller"
import { BatchStore } from "@/backend/storage/multiverse/batch-store"
import { multiverseRequestSchema } from "@/shared/multiverse-schema"
import { MultiverseJobs } from "./jobs"
import { batchFixture } from "./test-fixtures"

test("remote mode changes, exact approval and cancellation remain isolated to their worlds", async () => {
  const f = await batchFixture()
  const waiting = Promise.withResolvers<void>(), changed = Promise.withResolvers<void>(), firstDone = Promise.withResolvers<void>()
  const modes: boolean[] = []
  let observeModes = false
  const update = f.jobs.store.update.bind(f.jobs.store)
  const observe = spyOn(f.jobs.store, "update").mockImplementation(async (...args) => {
    const record = await update(...args)
    if (record.worlds.every(world => world.status === "waiting")) waiting.resolve()
    if (observeModes) {
      const mode = record.worlds[0]!.autoContinue
      if (modes.at(-1) !== mode) modes.push(mode)
      if (modes.length === 2) changed.resolve()
    }
    if (record.worlds[0]?.status === "completed") firstDone.resolve()
    return record
  })
  let id: string | undefined, work: Promise<void> | undefined
  try {
    const batch = await f.jobs.create(crypto.randomUUID(), multiverseRequestSchema.parse({ scenarioId: f.source.id,
      worldCount: 2, autoContinue: false, controls: { maxRound: 2, actionsPerType: 1 } }))
    id = batch.id; work = f.jobs.start(id)
    await waiting.promise
    const remote = new MultiverseJobs(new BatchStore(f.jobs.store.rootDir), f.runtime)
    observeModes = true
    const request = new Request(`http://localhost/api/multiverse/${id}/worlds/${batch.worlds[0]!.id}/automatic`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: true }),
    })
    const accepted = await routeMultiverse(remote, request, new URL(request.url))
    expect(accepted.status).toBe(202)
    expect(await accepted.json()).toEqual({ status: "accepted" })
    await remote.automatic(id, batch.worlds[0]!.id, false)
    await changed.promise
    expect(modes).toEqual([true, false])
    await expect(remote.continue(id, batch.worlds[0]!.id, 2)).rejects.toThrow("waiting round")
    await remote.continue(id, batch.worlds[0]!.id, 1)
    await remote.continue(id, batch.worlds[0]!.id, 1)
    await firstDone.promise
    expect((await remote.read(id)).worlds[1]?.status).toBe("waiting")
    await remote.cancel(id, batch.worlds[1]!.id)
    await work
    const final = await remote.read(id)
    expect(final.worlds.map(world => world.status)).toEqual(["completed", "canceled"])
    expect(final.status).toBe("partial")
  } finally { if (id) await f.jobs.cancel(id); await work; observe.mockRestore(); await f.close() }
}, 15_000)

test("an active controller cancels a preparing world while its sibling completes", async () => {
  const entered = Promise.withResolvers<void>()
  let heldWorld: string | undefined
  const f = await batchFixture(async (call, signal) => {
    if (call.id !== "opening-setting" || currentModelExecution()?.owner !== heldWorld) return
    entered.resolve()
    await new Promise<void>((_resolve, reject) => {
      if (signal.aborted) reject(signal.reason)
      else signal.addEventListener("abort", () => reject(signal.reason), { once: true })
    })
  })
  let id: string | undefined, work: Promise<void> | undefined
  try {
    const batch = await f.jobs.create(crypto.randomUUID(), multiverseRequestSchema.parse({ scenarioId: f.source.id,
      worldCount: 2, controls: { maxRound: 1, actionsPerType: 1 } }))
    id = batch.id; heldWorld = batch.worlds[0]!.id; work = f.jobs.start(id)
    await entered.promise
    await f.jobs.cancel(id, heldWorld)
    await work
    const final = await f.jobs.read(id)
    expect(final.worlds.map(world => world.status)).toEqual(["canceled", "completed"])
    expect(f.calls.filter(call => call.id === "opening-setting")).toHaveLength(1)
    expect(f.runningRuns.size).toBe(0)
  } finally { if (id) await f.jobs.cancel(id); await work; await f.close() }
}, 10_000)

test("command-storage failure interrupts supervision instead of reporting user cancellation", async () => {
  const entered = Promise.withResolvers<void>()
  const f = await batchFixture(async (call, signal) => {
    if (call.id !== "opening-setting") return
    entered.resolve()
    await new Promise<void>((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }))
  })
  const batch = await f.jobs.create(crypto.randomUUID(), multiverseRequestSchema.parse({ scenarioId: f.source.id, worldCount: 1, controls: {} }))
  const inbox = f.jobs.store.commands(batch.id)
  const pending = spyOn(inbox, "pending").mockImplementation(() => { throw new Error("Controlled command storage failure") })
  const commands = spyOn(f.jobs.store, "commands").mockReturnValue(inbox)
  let work: Promise<void> | undefined
  try {
    work = f.jobs.start(batch.id)
    await entered.promise
    await work
    const final = await f.jobs.read(batch.id)
    expect(final.status).toBe("interrupted")
    expect(final.stopReason).toBeUndefined()
    expect(f.jobs.store.execution(batch.id).isActive()).toBe(false)
    expect(f.calls).toHaveLength(0)
  } finally { pending.mockRestore(); commands.mockRestore(); await f.jobs.cancel(batch.id); await work; await f.close() }
})
