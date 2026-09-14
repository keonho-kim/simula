import { expect, test } from "bun:test"
import type { RunEvent } from "@/shared"
import { appendMetricData, emptyMetricData } from "./metric-data"

const event = (index: number): RunEvent => ({ type: "model.metrics", runId: "run", timestamp: String(index), metrics: {
  role: "actor", step: "message", attempt: 1, ttftMs: index, durationMs: 200, inputTokens: 10, reasoningTokens: 2, outputTokens: 3, totalTokens: 15, tokenSource: "provider",
} })
test("incremental metrics match a whole batch without mutating previously published data", () => {
  const first = appendMetricData(emptyMetricData(), [event(1)])
  const next = appendMetricData(first, [event(2), event(3)])
  expect(next).toEqual(appendMetricData(emptyMetricData(), [event(1), event(2), event(3)]))
  expect(first.totalTokens).toBe(15)
  expect(next.totalTokens).toBe(45)
  expect(next.ttft.chunks[0]!.points[0]).toBe(first.ttft.chunks[0]!.points[0])
  expect(next.inputTokens).toBe(30)
  expect(appendMetricData(next, [])).toBe(next)
})
