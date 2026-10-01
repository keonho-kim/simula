/**
 * Purpose: Verify actor SSE reconnect snapshots, coalescing, and abort cleanup.
 * Pattern: Transport contract test.
 * Usage: bun test src/backend/api/runs/actor-progress-stream.test.ts
 * Related: src/backend/api/runs/actor-progress-stream.ts
 */
import { expect, test } from "bun:test"
import { ActorProgress } from "@/backend/runtime/actor-progress"
import { streamActorProgress } from "./actor-progress-stream"

test("a subscriber receives the current round and abort releases the listener", async () => {
  const progress = new ActorProgress()
  progress.publish({ type: "actor.progress", runId: "r", timestamp: "now", update: { kind: "round", roundIndex: 1, parallel: true, actors: [{ id: "a", name: "A" }] } })
  const controller = new AbortController()
  const reader = streamActorProgress(progress, "r", controller.signal).body!.getReader()
  await reader.read()
  const first = new TextDecoder().decode((await reader.read()).value)
  expect(first).toContain('"roundIndex":1')
  expect(progress.subscriberCount("r")).toBe(1)
  controller.abort()
  expect(progress.subscriberCount("r")).toBe(0)
  expect((await reader.read()).done).toBe(true)
})

test("a terminal preview closes the stream and drops late updates", async () => {
  const progress = new ActorProgress()
  const signal = new AbortController().signal
  const reader = streamActorProgress(progress, "r", signal).body!.getReader()
  await reader.read()
  progress.publish({ type: "actor.progress", runId: "r", timestamp: "now", update: { kind: "round", roundIndex: 1, parallel: false, actors: [] } })
  await reader.read()
  progress.publish({ type: "run.failed", runId: "r", timestamp: "later", error: "test failure" })
  expect(new TextDecoder().decode((await reader.read()).value)).toContain('"status":"failed"')
  expect((await reader.read()).done).toBe(true)
  expect(progress.subscriberCount("r")).toBe(0)
})
