/**
 * Purpose: Verify world preparation excludes competing owners and preserves cancellation and successor state.
 * Pattern: Runtime concurrency contract tests.
 * Usage: bun test src/backend/runtime/worlds/ownership.test.ts
 * Related: src/backend/runtime/worlds/preparation.ts, src/backend/runtime/worlds/testing/fixture.ts
 */
import { expect, test } from "bun:test"
import { join } from "node:path"
import { ExecutionOwnership } from "@/backend/storage/generation/execution-lease"
import { routeWorlds } from "@/backend/api/worlds/world-controller"
import { worldFixture } from "./testing/fixture"

test("another runtime observes active world preparation and cancels it without duplicate calls", async () => {
  const f = await worldFixture(true)
  let work: Promise<void> | undefined
  try {
    const first = f.createJobs(), second = f.createJobs()
    work = first.start(f.id).completion
    await f.entered.promise
    const request = new Request(`http://localhost/api/worlds/${f.id}`)
    expect((await (await routeWorlds(second, request, new URL(request.url))).json()).world.status).toBe("preparing")
    const competing = second.start(f.id)
    expect(competing.alreadyRunning).toBe(true)
    await competing.completion
    expect(f.calls()).toBe(1)
    expect(second.cancel(f.id)).toBe(true)
    f.release.resolve(); await work
    expect((await f.store.read(f.id)).status).toBe("canceled")
    expect(await f.store.readTask(f.id, "opening")).toBeUndefined()
  } finally { f.release.resolve(); await work; await f.close() }
})

test("cancel immediately after world start persists before model admission", async () => {
  const f = await worldFixture(true)
  let work: Promise<void> | undefined
  try {
    const jobs = f.createJobs()
    work = jobs.start(f.id).completion
    expect(jobs.cancel(f.id)).toBe(true)
    await work
    expect((await f.store.read(f.id)).status).toBe("canceled")
    expect(f.calls()).toBe(0)
  } finally { f.release.resolve(); await work?.catch(() => undefined); await f.close() }
})

test("a displaced world worker cannot replace the successor's state or accept an opening", async () => {
  const f = await worldFixture(true)
  let work: Promise<void> | undefined
  try {
    work = f.createJobs().start(f.id).completion
    await f.entered.promise
    const replacement = new ExecutionOwnership(join(f.store.rootDir, f.id), () => Date.now() + 60_000).claim()
    if (!replacement) throw new Error("Missing successor")
    await f.store.write({ ...f.record, status: "failed", issue: "Successor owns the world." }, replacement)
    f.release.resolve(); await work
    expect((await f.store.read(f.id)).issue).toBe("Successor owns the world.")
    expect(await f.store.readTask(f.id, "opening")).toBeUndefined()
    expect(f.store.execution(f.id).isActive()).toBe(true)
    replacement.release()
  } finally { f.release.resolve(); await work; await f.close() }
})
