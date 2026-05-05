import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import type { RunEvent } from "@simula/shared"
import { dictionary } from "@/lib/i18n/dictionary"
import { ReportMetricsDashboard } from "./metrics-dashboard"

describe("ReportMetricsDashboard", () => {
  test("renders dashboard tabs and global averages", () => {
    const html = renderToStaticMarkup(
      <ReportMetricsDashboard
        events={[
          metricEvent("2026-04-30T00:00:00.000Z", 100, 1000, 400, 100, 500),
          metricEvent("2026-04-30T00:00:01.000Z", 300, 2000, 800, 200, 1000),
        ]}
        t={dictionary.en}
      />
    )

    expect(html).toContain("GLOBAL AVG")
    expect(html).toContain("CHARTS")
    expect(html).toContain("Input/Output usage")
    expect(html).toContain("Avg TTFT")
    expect(html).toContain("Avg Duration")
    expect(html).toContain("Avg Token/sec")
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
