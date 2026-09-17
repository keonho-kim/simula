import { expect, test } from "bun:test"
import type { RunEvent } from "@/shared"
import { dictionary } from "@/ui/i18n/dictionary"
import { buildPerformanceReport } from "./performance"

function metric(tokenSource: "provider" | "unavailable", attempt = 1): RunEvent {
  return { type: "model.metrics", runId: "r", timestamp: "2026-09-17T00:00:00Z", metrics: { role: "actor", step: "message", attempt, ttftMs: 100, durationMs: 1000, inputTokens: tokenSource === "provider" ? 100 : 0, outputTokens: tokenSource === "provider" ? 50 : 0, reasoningTokens: 0, totalTokens: tokenSource === "provider" ? 150 : 0, tokenSource } }
}

test("unavailable token usage is not displayed as zero throughput or total", () => {
  const report = buildPerformanceReport([metric("unavailable")], { role: "all" }, dictionary.en)
  expect(report.series[2]?.latestValue).toBe("—")
  expect(report.series[2]?.points?.length).toBe(0)
  expect(report.series[3]?.latestValue).toBe("—")
  expect(report.series[0]?.latestValue).toBe("100 ms")
  expect(report.measuredCount).toBe(0)
  expect(report.diagnostics.find(event => event.kind === "metric")?.body).toContain("—")
})

test("role and token filters retain only eligible calls and preserve explicitly scoped errors", () => {
  const events: RunEvent[] = [metric("provider"), metric("unavailable", 2), { type: "log", runId: "r", timestamp: "0", level: "error", message: "actor failed" }]
  const report = buildPerformanceReport(events, { role: "actor", minTokens: 100 }, dictionary.en)
  expect(report.sampleCount).toBe(1)
  expect(report.roles).toEqual([{ key: "actor", calls: 1, duration: 1000, retries: 0, errors: 1 }])
  expect(report.series[3]?.latestValue).toBe("150")
  const all = buildPerformanceReport(events, { role: "all" }, dictionary.en)
  expect(all.series[2]?.latestValue).toBe("150 tok/s")
  expect(all.roles.find(role => role.key === "actor")?.retries).toBe(1)
  const empty = buildPerformanceReport(events, { role: "actor", minTokens: 500 }, dictionary.en)
  expect(empty.series[0]?.latestValue).toBe("—")
})
