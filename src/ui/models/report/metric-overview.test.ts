/**
 * Purpose: Verify run-level report metric aggregation and missing provider usage behavior.
 * Pattern: Contract Test.
 * Usage: Run with `bun test src/ui/models/report/metric-overview.test.ts`.
 * Related: src/ui/models/report/metric-overview.ts, src/ui/components/report/metric-overview.tsx
 */
import { expect, test } from "bun:test"
import type { RunEvent } from "@/shared"
import { dictionary } from "@/ui/i18n/dictionary"
import { buildReportMetricSeries } from "./metric-overview"

test("uses run averages for latency and throughput and cumulative provider token usage", () => {
  const series = buildReportMetricSeries([
    metric({ ttftMs: 100, durationMs: 1_000, inputTokens: 100, reasoningTokens: 10, outputTokens: 50, totalTokens: 150 }),
    metric({ ttftMs: 300, durationMs: 2_000, inputTokens: 200, reasoningTokens: 20, outputTokens: 100, totalTokens: 300 }),
  ], dictionary.en)

  expect(series[0]?.latestValue).toBe("200 ms")
  expect(series[1]?.latestValue).toBe("1,500 ms")
  expect(series[2]?.latestValue).toBe("150 tok/s")
  expect(series[3]?.latestValue).toBe("450")
  expect(series[3]?.tokenBreakdown).toEqual({ inputTokens: "300", reasoningTokens: "30", outputTokens: "150" })
  expect(series.map((item) => item.sampleCount)).toEqual([2, 2, 2, 2])
})

test("keeps recorded latency but marks throughput and tokens unavailable without provider usage", () => {
  const series = buildReportMetricSeries([
    metric({ ttftMs: 125, durationMs: 875, tokenSource: "unavailable" }),
  ], dictionary.en)

  expect(series[0]?.latestValue).toBe("125 ms")
  expect(series[1]?.latestValue).toBe("875 ms")
  expect(series[2]?.latestValue).toBe("—")
  expect(series[2]?.points?.length).toBe(0)
  expect(series[3]?.latestValue).toBe("—")
  expect(series[3]?.tokenBreakdown).toEqual({ inputTokens: "—", reasoningTokens: "—", outputTokens: "—" })
  expect(series.map((item) => item.sampleCount)).toEqual([1, 1, 0, 0])
})

function metric(overrides: Partial<Extract<RunEvent, { type: "model.metrics" }>["metrics"]>): Extract<RunEvent, { type: "model.metrics" }> {
  return {
    type: "model.metrics",
    runId: "run-report",
    timestamp: "2026-09-22T00:00:00.000Z",
    metrics: {
      role: "actor",
      step: "message",
      attempt: 1,
      ttftMs: 0,
      durationMs: 0,
      inputTokens: 0,
      reasoningTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      tokenSource: "provider",
      ...overrides,
    },
  }
}
