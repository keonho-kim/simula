import { describe, expect, test } from "bun:test"
import type { RunEvent } from "@simula/shared"
import { buildReportMetrics } from "./report-metrics-view-model"

describe("report metrics view model", () => {
  test("computes global averages and time series", () => {
    const metrics = buildReportMetrics([
      metricEvent("2026-04-30T00:00:00.000Z", 100, 1000, 400, 100, 500),
      metricEvent("2026-04-30T00:00:01.000Z", 300, 2000, 800, 200, 1000),
    ])

    expect(metrics.averages.ttft).toBe(200)
    expect(metrics.averages.duration).toBe(1500)
    expect(metrics.averages.tokensPerSecond).toBe(400)
    expect(metrics.series.ttft.map((point) => point.value)).toEqual([100, 300])
    expect(metrics.series.duration.map((point) => point.timestamp)).toEqual([
      "2026-04-30T00:00:00.000Z",
      "2026-04-30T00:00:01.000Z",
    ])
  })

  test("bins input and output tokens into 4x4 average matrices", () => {
    const metrics = buildReportMetrics([
      metricEvent("2026-04-30T00:00:00.000Z", 100, 1000, 400, 100, 500),
      metricEvent("2026-04-30T00:00:01.000Z", 300, 1000, 480, 120, 300),
      metricEvent("2026-04-30T00:00:02.000Z", 900, 3000, 2500, 1600, 900),
    ])

    expect(metrics.binLabels).toEqual(["~500", "~1000", "~1500", "~2000+"])
    expect(metrics.matrix.ttft[0]?.[0]?.value).toBe(200)
    expect(metrics.matrix.ttft[1]?.[3]?.value).toBe(900)
    expect(metrics.matrix.duration[1]?.[0]?.value).toBeUndefined()
  })

  test("handles runs without metrics", () => {
    const metrics = buildReportMetrics([])

    expect(metrics.samples).toEqual([])
    expect(metrics.averages.ttft).toBeUndefined()
    expect(metrics.series.tokensPerSecond).toEqual([])
    expect(metrics.matrix.tokensPerSecond.flat().every((cell) => cell.value === undefined)).toBe(true)
  })
})

function metricEvent(
  timestamp: string,
  ttftMs: number,
  durationMs: number,
  totalTokens: number,
  inputTokens: number,
  outputTokens: number
): Extract<RunEvent, { type: "model.metrics" }> {
  return {
    type: "model.metrics",
    runId: "run-1",
    timestamp,
    metrics: {
      role: "planner",
      step: "coreSituation",
      attempt: 1,
      ttftMs,
      durationMs,
      inputTokens,
      reasoningTokens: 0,
      outputTokens,
      totalTokens,
      tokenSource: "provider",
    },
  }
}
