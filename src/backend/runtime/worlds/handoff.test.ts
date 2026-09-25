/**
 * Purpose: Verify world handoff is exclusive, fenced at run publication, and recoverable after interruption.
 * Pattern: Runtime and repository integration tests.
 * Usage: bun test src/backend/runtime/worlds/handoff.test.ts
 * Related: src/backend/runtime/worlds/preparation.ts, src/backend/storage/runs/run-store.ts
 */
import { expect, test } from "bun:test"
import { join } from "node:path"
import type { RunManifest } from "@/shared/run"
import { RunStore } from "@/backend/storage/runs/run-store"
import { ExecutionOwnership } from "@/backend/storage/generation/execution-lease"
import { worldFixture } from "./testing/fixture"

class HeldRunStore extends RunStore {
  readonly entered = Promise.withResolvers<void>()
  readonly release = Promise.withResolvers<void>()
  override async createRun(...args: Parameters<RunStore["createRun"]>): Promise<RunManifest> {
    this.entered.resolve(); await this.release.promise
    return super.createRun(...args)
  }
}

class InterruptedRunStore extends RunStore {
  override async createRun(...args: Parameters<RunStore["createRun"]>): Promise<RunManifest> {
    await super.createRun(...args)
    throw new Error("Stopped after run publication")
  }
}

test("concurrent handoff is exclusive and another runtime later receives the same run", async () => {
  const f = await worldFixture()
  const held = new HeldRunStore({ rootDir: f.runs.rootDir })
  let work: Promise<RunManifest> | undefined
  try {
    await f.createJobs().start(f.id).completion
    work = f.createJobs(held).materializeRun(f.id)
    await held.entered.promise
    await expect(f.createJobs().materializeRun(f.id)).rejects.toThrow("already running")
    held.release.resolve()
    const run = await work
    expect((await f.createJobs().materializeRun(f.id)).id).toBe(run.id)
    expect(await f.runs.listRuns()).toHaveLength(1)
  } finally { held.release.resolve(); await work?.catch(() => undefined); await f.close() }
})

test("an expired handoff cannot publish a run after its successor acquires the world", async () => {
  const f = await worldFixture()
  const held = new HeldRunStore({ rootDir: f.runs.rootDir })
  let work: Promise<RunManifest> | undefined
  try {
    await f.createJobs().start(f.id).completion
    work = f.createJobs(held).materializeRun(f.id)
    const outcome = work.then(() => undefined, error => error)
    await held.entered.promise
    const successor = new ExecutionOwnership(join(f.store.rootDir, f.id), () => Date.now() + 60_000).claim()
    if (!successor) throw new Error("Missing successor")
    held.release.resolve()
    expect(await outcome).toBeInstanceOf(Error)
    expect(await f.runs.listRuns()).toHaveLength(0)
    expect((await f.store.read(f.id)).runId).toBeUndefined()
    successor.release()
  } finally { held.release.resolve(); await work?.catch(() => undefined); await f.close() }
})

test("run creation without the world link recovers without another run or duplicated preparation usage", async () => {
  const f = await worldFixture()
  try {
    await f.createJobs().start(f.id).completion
    await f.store.appendMetrics(f.id, { role: "storyBuilder", step: "draft", attempt: 1, ttftMs: 5, durationMs: 10,
      inputTokens: 5, reasoningTokens: 0, outputTokens: 3, totalTokens: 8, tokenSource: "provider" })
    const calls = f.calls()
    const interrupted = new InterruptedRunStore({ rootDir: f.runs.rootDir })
    await expect(f.createJobs(interrupted).materializeRun(f.id)).rejects.toThrow("Stopped after run publication")
    expect((await f.store.read(f.id)).runId).toBeUndefined()
    const existing = await f.runs.listRuns()
    expect(existing).toHaveLength(1)
    const recovered = await f.createJobs().materializeRun(f.id)
    expect(recovered.id).toBe(existing[0]?.id)
    expect((await f.store.read(f.id)).runId).toBe(recovered.id)
    expect(await f.runs.readEvents(recovered.id)).toHaveLength(1)
    expect(f.calls()).toBe(calls)
  } finally { await f.close() }
})

test("canceling a held handoff preserves the prepared story without publishing a run", async () => {
  const f = await worldFixture()
  const held = new HeldRunStore({ rootDir: f.runs.rootDir })
  let work: Promise<RunManifest> | undefined
  try {
    await f.createJobs().start(f.id).completion
    work = f.createJobs(held).materializeRun(f.id)
    const outcome = work.then(() => undefined, error => error)
    await held.entered.promise
    expect(f.createJobs().cancel(f.id)).toBe(true)
    held.release.resolve()
    expect(await outcome).toBeInstanceOf(Error)
    expect(await f.runs.listRuns()).toHaveLength(0)
    expect((await f.store.read(f.id)).status).toBe("ready")
    expect((await f.createJobs().materializeRun(f.id)).id).toBe(`world-${f.id}`)
  } finally { held.release.resolve(); await work?.catch(() => undefined); await f.close() }
})
