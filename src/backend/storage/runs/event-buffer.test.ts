/**
 * Purpose: Verify that browser-confirmed event prefixes leave stable resume cursors.
 * Pattern: Storage contract tests.
 * Usage: bun test src/backend/storage/runs/event-buffer.test.ts
 * Related: src/backend/storage/runs/event-buffer.ts
 */
import { expect, test } from "bun:test"
import type { RunEvent } from "@/shared/run"
import { RunEventBuffer } from "./event-buffer"

const event = (message: string): RunEvent => ({ type: "log", runId: "run", timestamp: "2026-01-01T00:00:00.000Z", level: "info", message })

test("acknowledged prefixes are released while cursors and live tail remain stable", async () => {
  const buffer = new RunEventBuffer("run")
  const first = buffer.append(event("first"))
  const second = buffer.append(event("second"))
  const reader = buffer.open()
  expect((await reader.next())?.cursor).toBe(`run:${first}`)
  expect(buffer.prune(first)).toBe(true)
  expect(buffer.retainedCount).toBe(1)
  expect((await reader.next())?.cursor).toBe(`run:${second}`)
  const resumed = buffer.open(`run:${first}`)
  expect((await resumed.next())?.event).toEqual(event("second"))
  expect(buffer.prune(second)).toBe(true)
  expect(buffer.retainedCount).toBe(0)
  const third = buffer.append(event("third"))
  expect((await resumed.next())?.cursor).toBe(`run:${third}`)
  expect(() => buffer.open()).toThrow("confirmed")
  await reader.close(); await resumed.close()
})

test("only complete in-scope event offsets can be acknowledged", () => {
  const buffer = new RunEventBuffer("run")
  const first = buffer.append(event("first"))
  expect(buffer.prune(first - 1)).toBe(false)
  expect(buffer.prune(first + 1)).toBe(false)
  expect(buffer.retainedCount).toBe(1)
  expect(() => buffer.open("other:0")).toThrow("cursor")
  expect(() => buffer.append({ ...event("foreign"), runId: "other" })).toThrow("scope")
})
