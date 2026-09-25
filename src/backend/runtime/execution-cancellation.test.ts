/**
 * Purpose: Verify live simulation cancellation and independence from view subscriptions.
 * Pattern: Runtime and HTTP integration test.
 * Usage: bun test src/backend/runtime/execution-cancellation.test.ts
 * Related: src/backend/runtime/execute-run.ts, src/backend/api/runs/event-stream.ts
 */
import { expect, spyOn, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { RunStore } from "@/backend/storage/runs/run-store"
import { streamEvents } from "@/backend/api/runs/event-stream"
import { executeRun } from "./execute-run"
import { ModelAdmission } from "./model-admission"
import { RoundContinuationStore } from "./round-continuation"
import { Subscriptions } from "./events"

test("closing a run stream leaves execution active; explicit cancellation aborts live model work", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-live-cancel-"))
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const server = Bun.serve({ port: 0, async fetch() { entered.resolve(); await release.promise; return new Response("unused") } })
  const store = new RunStore({ rootDir: root })
  const subscriptions = new Subscriptions()
  const continuations = new RoundContinuationStore()
  const admission = new ModelAdmission({ concurrency: 1 })
  const scenario = { text: "Review the investment.", controls: { numCast: 1, actionsPerType: 1, maxRound: 1, fastMode: false, allowAdditionalCast: false } }
  const run = await store.createRun(scenario)
  const running = new Set([run.id])
  const settings = defaultSettings()
  for (const role of Object.values(settings.roles)) { role.provider = "vllm"; role.model = "local-test" }
  settings.providers.vllm = { apiKey: "local-test", baseUrl: `http://127.0.0.1:${server.port}/v1` }
  const execution = executeRun(store, subscriptions, running, continuations, run, scenario, settings, admission)
  try {
    await entered.promise
    const reader = (await streamEvents(store, subscriptions, run.id)).body?.getReader()
    if (!reader) throw new Error("Missing event stream")
    await reader.read()
    await reader.cancel()
    expect(subscriptions.has(run.id)).toBe(false)
    expect(continuations.isCanceled(run.id)).toBe(false)
    expect(running.has(run.id)).toBe(true)
    expect(admission.snapshot().active).toBe(1)
    continuations.cancel(run.id)
    await execution
    expect((await store.readManifest(run.id)).status).toBe("canceled")
    expect((await store.readEvents(run.id)).filter(event => event.type === "run.failed")).toHaveLength(0)
    expect((await store.readEvents(run.id)).filter(event => event.type === "run.canceled")).toHaveLength(1)
    expect(running.size).toBe(0)
    expect(admission.snapshot()).toEqual({ active: 0, waiting: 0, pools: 0 })
  } finally {
    continuations.cancel(run.id); release.resolve(); await execution
    await server.stop(true); await rm(root, { recursive: true, force: true })
  }
})

test("a subscription aborted while its log opens never attaches a late listener", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-stream-open-"))
  const store = new RunStore({ rootDir: root })
  const run = await store.createRun({ text: "Review", controls: { numCast: 1, actionsPerType: 1, maxRound: 1, fastMode: false, allowAdditionalCast: false } })
  const log = await store.openEventLog(run.id)
  const opened = Promise.withResolvers<typeof log>()
  const read = spyOn(store, "openEventLog").mockImplementation(() => opened.promise)
  const subscriptions = new Subscriptions(), controller = new AbortController()
  try {
    const pending = streamEvents(store, subscriptions, run.id, undefined, controller.signal)
    controller.abort()
    opened.resolve(log)
    const response = await pending
    expect(await response.text()).toBe("")
    expect(subscriptions.size).toBe(0)
  } finally { read.mockRestore(); await log.close(); await rm(root, { recursive: true, force: true }) }
})
