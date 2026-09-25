/**
 * Purpose: Verify live task selection, replacement drafts, and bounded preview retention.
 * Pattern: Subscription contract tests.
 * Usage: bun test src/backend/runtime/generation/progress.test.ts
 * Related: src/backend/runtime/generation/progress.ts, src/backend/api/generation/generation-stream.ts
 */
import { expect, test } from "bun:test"
import type { GenerationProgressEvent } from "@/shared/generation"
import { GenerationProgress } from "./progress"
import { streamGenerationProgress } from "@/backend/api/generation/generation-stream"

test("only selected task receives live drafts; retries replace snapshots and ignore stale duplicates", () => {
  const progress = new GenerationProgress()
  const overview: GenerationProgressEvent[] = []
  const detail: GenerationProgressEvent[] = []
  progress.subscribe(undefined, event => overview.push(event))
  const unsubscribe = progress.subscribe("first", event => detail.push(event))
  progress.publish({ type: "task", taskId: "first", kind: "evidence", attempt: 1, status: "running" })
  progress.publish({ type: "draft", taskId: "first", attempt: 1, sequence: 1, text: "old" })
  progress.publish({ type: "draft", taskId: "first", attempt: 1, sequence: 1, text: "old" })
  progress.publish({ type: "task", taskId: "first", kind: "evidence", attempt: 2, status: "running" })
  progress.publish({ type: "draft", taskId: "first", attempt: 1, sequence: 2, text: "late" })
  progress.publish({ type: "draft", taskId: "first", attempt: 2, sequence: 1, text: "new" })
  expect(overview.some(value => value.type === "event" && value.event.type === "draft")).toBe(false)
  expect(detail.filter(value => value.type === "event" && value.event.type === "draft")).toHaveLength(2)
  const reconnected: GenerationProgressEvent[] = []
  progress.subscribe("first", event => reconnected.push(event))
  expect(reconnected[0]).toMatchObject({ type: "snapshot", draft: { fields: [{ key: "content", text: "new" }], attempt: 2, sequence: 1 } })
  unsubscribe()
  progress.finish()
  expect(reconnected.at(-1)?.type).toBe("terminal")
})

test("SSE cancellation unsubscribes without canceling generation or retaining unlimited history", async () => {
  const progress = new GenerationProgress()
  const abort = new AbortController()
  const response = streamGenerationProgress(progress, "selected", abort.signal)
  const reader = response.body!.getReader()
  expect((await reader.read()).done).toBe(false)
  await reader.cancel()
  for (let index = 0; index < 100; index++) {
    progress.publish({ type: "task", taskId: `task-${index}`, kind: "facet", attempt: 1, status: "completed" })
  }
  const events: GenerationProgressEvent[] = []
  progress.subscribe(undefined, event => events.push(event))
  expect(events[0].type).toBe("snapshot")
  if (events[0].type === "snapshot") expect(events[0].tasks).toHaveLength(64)
  progress.finish()
})

test("SSE sends a selected plain-text draft as a visible field", async () => {
  const progress = new GenerationProgress()
  const response = streamGenerationProgress(progress, "situation-title", new AbortController().signal)
  const reader = response.body!.getReader()
  const decode = (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(bytes).match(/data: (.+)/)?.[1] ?? "null")
  try {
    await reader.read() // Initial snapshot precedes live task events.
    progress.publish({ type: "task", taskId: "situation-title", kind: "situation", attempt: 1, status: "running" })
    await reader.read()
    progress.publish({ type: "draft", taskId: "situation-title", attempt: 1, sequence: 1, text: "The review begins" })
    const next = await reader.read()
    expect(next.done).toBe(false)
    if (!next.value) throw new Error("Selected task draft was not sent.")
    expect(decode(next.value)).toMatchObject({ type: "event", event: { taskId: "situation-title",
      fields: [{ key: "content", text: "The review begins" }] } })
  } finally { await reader.cancel(); progress.finish() }
})

test("a slow live section retains its draft while more than 64 other tasks complete", () => {
  const progress = new GenerationProgress()
  progress.publish({ type: "task", taskId: "materials-detail", kind: "report-detail", attempt: 1, status: "running" })
  progress.publish({ type: "draft", taskId: "materials-detail", attempt: 1, sequence: 1, text: "Still writing" })
  for (let index = 0; index < 100; index++) progress.publish({ type: "task", taskId: `evidence-${index}`, kind: "report-evidence", attempt: 1, status: "completed" })
  const received: GenerationProgressEvent[] = []
  progress.subscribe("materials-detail", event => received.push(event))
  expect(received[0]).toMatchObject({ type: "snapshot", draft: { taskId: "materials-detail", fields: [{ key: "content", text: "Still writing" }] } })
  if (received[0].type === "snapshot") expect(received[0].tasks.some(task => task.taskId === "materials-detail")).toBe(true)
})

test("a failed subscriber cannot prevent terminal cleanup", () => {
  const progress = new GenerationProgress()
  progress.subscribe(undefined, event => { if (event.type === "terminal") throw new Error("reader closed") })
  expect(() => progress.finish()).not.toThrow()
})
