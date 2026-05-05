import { beforeEach, describe, expect, test } from "bun:test"
import type { RunEvent } from "@simula/shared"
import { renderToStaticMarkup } from "react-dom/server"
import { dictionary } from "@/lib/i18n/dictionary"
import { useRunStore } from "@/store/run-store"
import { LlmMetricsPanelView } from "./llm-metrics-panel"

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

    const html = renderToStaticMarkup(<LlmMetricsPanelView events={events} t={dictionary.en} />)

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
