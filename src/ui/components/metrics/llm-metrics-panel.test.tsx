/**
 * Purpose: Verify live and report-context LLM metric card rendering.
 * Pattern: Server-rendered component contract test.
 * Usage: Run with `bun test src/ui/components/metrics/llm-metrics-panel.test.tsx`.
 * Related: src/ui/components/metrics/llm-metrics-panel.tsx
 */
import { appendMetricData, emptyMetricData } from "@/ui/models/metrics/metric-data"
import { beforeEach, describe, expect, test } from "bun:test"
import type { RunEvent } from "@/shared"
import { renderToStaticMarkup } from "react-dom/server"
import { dictionary } from "@/ui/i18n/dictionary"
import { useRunStore } from "@/ui/stores/run-store"
import { LlmMetricsPanelView, MetricPanel } from "@/ui/components/metrics/llm-metrics-panel"
import { buildMetricSeries } from "@/ui/models/metrics/metric-series"

const runId = "run-test"

describe("LlmMetricsPanel", () => {
  beforeEach(() => {
    useRunStore.getState().resetLiveState()
  })

  test("renders cumulative total, input, reasoning, and output tokens in the total card", () => {
    const events = [
      modelMetrics("planner", "coreSituation", 1000, 40, 240),
      modelMetrics("actor", "message", 11039, 60, 760),
    ]
    useRunStore.getState().pushEvents(events)

    expect(useRunStore.getState().metricEvents).toEqual(events)

    const html = renderToStaticMarkup(<LlmMetricsPanelView data={appendMetricData(emptyMetricData(), events)} t={dictionary.en} />)

    expect(html).toContain("Total Tokens")
    expect(html).toContain("13,039")
    expect(html).toContain("Input Tokens")
    expect(html).toContain("12,039")
    expect(html).toContain("Reasoning Tokens")
    expect(html).toContain("100")
    expect(html).toContain("Output Tokens")
    expect(html).toContain("1,000")
    expect(html).not.toContain("metric-grid-total-tokens")
  })

  test("shows the sample count and chart in report context", () => {
    const data = appendMetricData(emptyMetricData(), [
      modelMetrics("planner", "coreSituation", 100, 10, 50),
      modelMetrics("actor", "message", 200, 20, 100),
    ])
    const series = buildMetricSeries(data, dictionary.en)[0]!
    const html = renderToStaticMarkup(
      <MetricPanel context="report" series={series} t={dictionary.en} />
    )

    expect(html).toContain("2 samples")
    expect(html).toContain("<svg")
    expect(html).not.toContain("Live")
  })
})

function modelMetrics(
  role: Extract<RunEvent, { type: "model.metrics" }>["metrics"]["role"],
  step: Extract<RunEvent, { type: "model.metrics" }>["metrics"]["step"],
  inputTokens: number,
  reasoningTokens: number,
  outputTokens: number
): Extract<RunEvent, { type: "model.metrics" }> {
  return {
    type: "model.metrics",
    runId,
    timestamp: "2026-04-28T00:00:00.000Z",
    metrics: {
      role,
      step,
      attempt: 1,
      ttftMs: 10,
      durationMs: 100,
      inputTokens,
      reasoningTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      tokenSource: "provider",
    },
  }
}
