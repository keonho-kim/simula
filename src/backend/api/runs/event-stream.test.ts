/**
 * Purpose: Verify lossless replay, resume cursors, process-local append delivery, and disposal.
 * Pattern: SSE integration contract tests.
 * Usage: bun test src/backend/api/runs/event-stream.test.ts
 * Related: src/backend/api/runs/event-stream.ts, src/backend/storage/runs/event-log.ts
 */
import { expect, spyOn, test } from "bun:test"
import { appendFile, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { RunStore } from "@/backend/storage/runs/run-store"
import { appendAndPublish, Subscriptions } from "@/backend/runtime/events"
import { streamEvents } from "./event-stream"

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "simula-event-stream-"))
  const store = new RunStore({ rootDir: root }), subscriptions = new Subscriptions()
  const run = await store.createRun({ text: "Review", controls: { numCast: 1, actionsPerType: 1, maxRound: 1, fastMode: false, allowAdditionalCast: false } })
  const lease = store.execution(run.id).claim()
  if (!lease) throw new Error("Missing owner")
  const emit = (message: string) => appendAndPublish(store, subscriptions, {
    type: "log", runId: run.id, timestamp: new Date().toISOString(), level: "info", message,
  }, lease)
  return { root, store, run, lease, subscriptions, emit,
    close: async () => { lease.release(); await rm(root, { recursive: true, force: true }) } }
}

async function eventFrame(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  for (;;) {
    const result = await reader.read()
    if (result.done) throw new Error("Stream ended before expected event")
    const text = new TextDecoder().decode(result.value)
    if (text.startsWith("id:")) return text
  }
}

test("events committed while history is loading appear once and reconnect starts after its cursor", async () => {
  const f = await fixture()
  await f.emit("first")
  const log = await f.store.openEventLog(f.run.id)
  const captured = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  const next = log.next.bind(log)
  let first = true
  const read = spyOn(log, "next").mockImplementation(async () => {
    const entry = await next()
    if (first) { first = false; captured.resolve(); await release.promise }
    return entry
  })
  const open = spyOn(f.store, "openEventLog").mockResolvedValue(log)
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    reader = (await streamEvents(f.store, f.subscriptions, f.run.id)).body!.getReader()
    await captured.promise
    await f.emit("during replay")
    release.resolve()
    const one = await eventFrame(reader), two = await eventFrame(reader)
    expect(one).toContain('"message":"first"')
    expect(two).toContain('"message":"during replay"')
    const cursor = one.split("\n")[0]!.slice(4)
    await reader.cancel(); open.mockRestore(); read.mockRestore()
    reader = (await streamEvents(f.store, f.subscriptions, f.run.id, cursor)).body!.getReader()
    expect(await eventFrame(reader)).toBe(two)
    await f.emit("third")
    expect(await eventFrame(reader)).toContain('"message":"third"')
    await reader.cancel()
    expect(f.subscriptions.size).toBe(0)
    expect((await streamEvents(f.store, f.subscriptions, f.run.id, "other:0")).status).toBe(400)
  } finally { release.resolve(); await reader?.cancel(); open.mockRestore(); read.mockRestore(); await f.close() }
})

test("a process-local append reaches the stream without a publisher notification", async () => {
  const f = await fixture()
  const reader = (await streamEvents(f.store, f.subscriptions, f.run.id)).body!.getReader()
  try {
    await reader.read()
    await f.store.appendEvent({ type: "log", runId: f.run.id, timestamp: new Date().toISOString(), level: "info", message: "local" }, f.lease)
    expect(await eventFrame(reader)).toContain('"message":"local"')
    await reader.cancel()
    expect(f.subscriptions.size).toBe(0)
  } finally { await reader.cancel(); await f.close() }
})

test("terminal history drains before stream end, then releases its listener", async () => {
  const f = await fixture()
  try {
    await f.emit("final accepted record")
    await f.store.writeManifest({ ...f.run, status: "completed" }, f.lease)
    f.lease.release()
    const response = await streamEvents(f.store, f.subscriptions, f.run.id)
    const text = await response.text()
    expect(text.indexOf('"message":"final accepted record"')).toBeLessThan(text.indexOf("event: stream.end"))
    expect(f.subscriptions.size).toBe(0)
  } finally { await f.close() }
})

test("a slow reader stops log read-ahead and cancellation closes its cursor", async () => {
  const f = await fixture()
  const log = await f.store.openEventLog(f.run.id)
  const original = log.next.bind(log)
  const filled = Promise.withResolvers<void>()
  let reads = 0
  const next = spyOn(log, "next").mockImplementation(async () => {
    const value = await original()
    if (++reads === 2) filled.resolve()
    return value
  })
  const close = spyOn(log, "close")
  const open = spyOn(f.store, "openEventLog").mockResolvedValue(log)
  let response: Response | undefined
  try {
    for (let i = 0; i < 20; i++) await f.emit(`${i}:` + "x".repeat(40_000))
    response = await streamEvents(f.store, f.subscriptions, f.run.id)
    await filled.promise
    await new Promise<void>(resolve => setImmediate(resolve))
    expect(reads).toBeLessThan(4)
    await response.body?.cancel()
    expect(close).toHaveBeenCalledTimes(1)
    expect(f.subscriptions.size).toBe(0)
  } finally { await response?.body?.cancel(); next.mockRestore(); open.mockRestore(); close.mockRestore(); await log.close(); await f.close() }
})

test("corrupt persisted history sends an explicit stream failure without canceling the owner", async () => {
  const f = await fixture()
  try {
    await appendFile(f.store.path(f.run.id, "events.jsonl"), "not JSON\n")
    const reopened = new RunStore({ rootDir: f.root })
    const body = await (await streamEvents(reopened, f.subscriptions, f.run.id)).text()
    expect(body).toContain("event: stream.error")
    expect(body).not.toContain("not JSON")
    expect(f.store.execution(f.run.id).isActive()).toBe(true)
    expect(f.subscriptions.size).toBe(0)
  } finally { await f.close() }
})
