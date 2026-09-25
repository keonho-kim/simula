/**
 * Purpose: Verify scoped monotonic progress and stable terminal facts under duplicate or stale events.
 * Pattern: Reducer contract tests.
 * Usage: bun test src/ui/models/simulation/round-continuation.test.ts
 * Related: src/ui/models/simulation/round-continuation.ts
 */
import { expect, test } from "bun:test"
import type { RunEvent } from "@/shared"
import { reduceRoundProgress } from "./round-continuation"

const runId = "run-1"
const timestamp = "2026-01-01T00:00:00.000Z"
const round = (roundIndex: number): RunEvent => ({ type: "round.completed", runId, timestamp, roundIndex })

test("unrelated telemetry and duplicate replay preserve the same progress reference", () => {
  const first = reduceRoundProgress({}, [round(3)], runId)
  expect(reduceRoundProgress(first, [round(1), round(3), { type: "run.started", runId, timestamp }], runId)).toBe(first)
  expect(reduceRoundProgress(first, [{ type: "log", runId, timestamp, level: "info", message: "Update" }], runId)).toBe(first)
})

test("progress cannot cross run scopes and old history cannot reopen a terminal run", () => {
  const completed: RunEvent = { type: "run.completed", runId, timestamp, stopReason: "simulation_done" }
  const final = reduceRoundProgress({}, [round(2), completed], runId)
  expect(reduceRoundProgress(final, [round(5)], runId)).toBe(final)
  const next = reduceRoundProgress(final, [completed, round(8)], "run-2")
  expect(next).toEqual({ runId: "run-2" })
})

test("a later terminal failure is retained when older completion history is replayed", () => {
  const completed: RunEvent = { type: "run.completed", runId, timestamp, stopReason: "simulation_done" }
  const failed: RunEvent = { type: "run.failed", runId, timestamp: "2026-01-01T00:00:01.000Z", error: "Final persistence failed" }
  const final = reduceRoundProgress({}, [completed, failed], runId)
  expect(reduceRoundProgress(final, [completed], runId)).toBe(final)
  expect(final.terminal).toEqual(failed)
})
