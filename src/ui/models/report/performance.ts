import type { RunEvent } from "@/shared"
import type { UiTexts } from "@/ui/types/i18n"
import { appendMetricData, emptyMetricData } from "@/ui/models/metrics/metric-data"
import { buildMetricSeries } from "@/ui/models/metrics/metric-series"
import { appendMetricHistory, emptyMetricHistory } from "@/ui/models/metrics/sample-history"
import { buildRoleDiagnostics, REPORT_SYSTEM_ROLES } from "./role-diagnostics"

export interface PerformanceFilter {
  role: string
  minTokens?: number
  maxTokens?: number
}

/** Missing provider usage stays missing; filters apply to call metrics, not unrelated logs. */
export function buildPerformanceReport(events: RunEvent[], filter: PerformanceFilter, t: UiTexts) {
  const samples = events.filter(
    (event): event is Extract<RunEvent, { type: "model.metrics" }> => event.type === "model.metrics"
  )
  const filtered = samples.filter(
    ({ metrics }) =>
      (filter.role === "all" || metrics.role === filter.role) &&
      (filter.minTokens === undefined ||
        (metrics.tokenSource === "provider" && metrics.totalTokens >= filter.minTokens)) &&
      (filter.maxTokens === undefined ||
        (metrics.tokenSource === "provider" && metrics.totalTokens <= filter.maxTokens))
  )
  const included = new Set(filtered)
  const diagnostics = buildRoleDiagnostics(
    events.filter((event) => event.type !== "model.metrics" || included.has(event)),
    t
  )
  const measured = filtered.filter((event) => event.metrics.tokenSource === "provider")
  const data = appendMetricData(emptyMetricData(), filtered)
  const throughput = measured
    .filter((event) => event.metrics.durationMs > 0)
    .map((event) => ({
      timestamp: event.timestamp,
      value: (event.metrics.totalTokens / event.metrics.durationMs) * 1000
    }))
  data.tokensPerSecond = appendMetricHistory(emptyMetricHistory(), throughput)
  const average = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined
  const averages = [
    average(filtered.map((event) => event.metrics.ttftMs)),
    average(filtered.map((event) => event.metrics.durationMs)),
    average(throughput.map((point) => point.value))
  ]
  const titles = [t.averageTtft, t.averageDuration, t.averageTokensPerSecond]
  const series = buildMetricSeries(data, t).map((item, index) =>
    index < 3
      ? {
          ...item,
          title: titles[index] ?? item.title,
          latestValue:
            averages[index] === undefined
              ? "—"
              : `${averages[index]?.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${index === 2 ? "tok/s" : "ms"}`
        }
      : {
          ...item,
          latestValue: measured.length
            ? measured.reduce((sum, event) => sum + event.metrics.totalTokens, 0).toLocaleString()
            : "—",
          tokenBreakdown: measured.length
            ? item.tokenBreakdown
            : { inputTokens: "—", reasoningTokens: "—", outputTokens: "—" }
        }
  )
  const roles = REPORT_SYSTEM_ROLES.filter((role) => filter.role === "all" || role === filter.role).map(
    (key) => {
      const calls = filtered.filter((event) => event.metrics.role === key)
      // This counts recorded error events, not distinct failed requests: both node and log events may describe one failure.
      const errors = diagnostics.filter(
        (event) =>
          event.role === key &&
          ((event.kind === "log" && event.title === "ERROR") ||
            (event.kind === "node" && event.title === "Node failed"))
      ).length
      return {
        key,
        calls: calls.length,
        duration: calls.length ? calls.reduce((sum, event) => sum + event.metrics.durationMs, 0) : undefined,
        retries: calls.filter((event) => event.metrics.attempt > 1).length,
        errors
      }
    }
  )
  return {
    series,
    roles,
    diagnostics: diagnostics,
    sampleCount: filtered.length,
    measuredCount: measured.length
  }
}
