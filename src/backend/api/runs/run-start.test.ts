/**
 * Purpose: Verify duplicate and completed run-start requests do not execute model work twice.
 * Pattern: Run lifecycle contract test.
 * Usage: bun test src/backend/api/runs/run-start.test.ts
 * Related: src/backend/api/runs/run-controller.ts
 */
import { seedRunManifest } from "@/backend/storage/runs/testing/fixtures"
import { ModelAdmission } from "@/backend/runtime/model-admission"
import { expect, spyOn, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import * as execution from "@/backend/runtime/execute-run"
import { RunStore } from "@/backend/storage/runs/run-store"
import { Subscriptions } from "@/backend/runtime/events"
import { RoundContinuationStore } from "@/backend/runtime/round-continuation"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { cancelRun, startRun } from "./run-controller"

test("run ownership is acquired before awaiting I/O and completed runs are not restarted", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "simula-start-owner-"))
  const execute = spyOn(execution, "executeRun").mockResolvedValue(undefined)
  try {
    const store = new RunStore({ rootDir })
    const run = await store.createRun({ text: "Review", controls: { numCast: 1, maxRound: 1, actionsPerType: 1, allowAdditionalCast: false, fastMode: false } })
    const running = new Set<string>()
    const subscriptions = new Subscriptions()
    const modelAdmission = new ModelAdmission({ concurrency: 8 })
    const continuations = new RoundContinuationStore()
    await Promise.all([1, 2].map(() => startRun(store, subscriptions, running, continuations, run.id, modelAdmission, async () => defaultSettings())))
    expect(execute).toHaveBeenCalledTimes(1)
    running.clear()
    await seedRunManifest(store, { ...run, status: "completed" })
    expect((await startRun(store, subscriptions, running, continuations, run.id, modelAdmission, async () => defaultSettings())).status).toBe(200)
    expect(execute).toHaveBeenCalledTimes(1)
    expect(running.size).toBe(0)
  } finally { execute.mockRestore(); await rm(rootDir, { recursive: true, force: true }) }
})

test("canceling while start loads settings is not erased before execution dispatch", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "simula-start-cancel-"))
  const original = execution.executeRun
  let completion: Promise<void> | undefined
  const execute = spyOn(execution, "executeRun").mockImplementation((...args) => {
    completion = original(...args)
    return completion
  })
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  let starting: Promise<Response> | undefined
  try {
    const store = new RunStore({ rootDir })
    const run = await store.createRun({ text: "Review", controls: { numCast: 1, maxRound: 1, actionsPerType: 1, allowAdditionalCast: false, fastMode: false } })
    const running = new Set<string>(), continuations = new RoundContinuationStore()
    starting = startRun(store, new Subscriptions(), running, continuations, run.id, new ModelAdmission({ concurrency: 1 }), async () => {
      entered.resolve(); await release.promise; return defaultSettings()
    })
    await entered.promise
    expect(cancelRun(store, running, continuations, run.id).status).toBe(202)
    release.resolve(); await starting; await completion
    expect((await store.readManifest(run.id)).status).toBe("canceled")
    expect((await store.readEvents(run.id)).some(event => event.type === "run.started")).toBe(false)
  } finally { release.resolve(); await starting; await completion; execute.mockRestore(); await rm(rootDir, { recursive: true, force: true }) }
})
