/**
 * Purpose: Build the four run-level metric series displayed above the Report tabs.
 * Pattern: Pure Function.
 * Usage: Imported by the Report metric overview component.
 * Related: src/ui/models/metrics/metric-data.ts, src/ui/models/metrics/metric-series.ts
 */
import type { RunEvent } from "@/shared"
import type { UiTexts } from "@/ui/types/i18n"
import { appendMetricData, emptyMetricData } from "@/ui/models/metrics/metric-data"
import { buildMetricSeries, type MetricSeries } from "@/ui/models/metrics/metric-series"
import { appendMetricHistory, emptyMetricHistory } from "@/ui/models/metrics/sample-history"

type MetricEvent = Extract<RunEvent, { type: "model.metrics" }>

export function buildReportMetricSeries(events: RunEvent[], t: UiTexts): MetricSeries[] {
  const samples = events.filter((event): event is MetricEvent => event.type === "model.metrics")
  const measured = samples.filter((event) => event.metrics.tokenSource === "provider")
  const allData = appendMetricData(emptyMetricData(), samples)
  const data = appendMetricData(emptyMetricData(), measured)
  data.ttft = allData.ttft
  data.duration = allData.duration

  const throughput = measured
    .filter((event) => event.metrics.durationMs > 0)
    .map((event) => ({
      timestamp: event.timestamp,
      value: (event.metrics.totalTokens / event.metrics.durationMs) * 1_000,
    }))
  data.tokensPerSecond = appendMetricHistory(emptyMetricHistory(), throughput)

  const averages = [
    average(samples.map((event) => event.metrics.ttftMs)),
    average(samples.map((event) => event.metrics.durationMs)),
    average(throughput.map((point) => point.value)),
  ]
  const titles = [t.averageTtft, t.averageDuration, t.averageTokensPerSecond]

  return buildMetricSeries(data, t).map((series, index) => {
    if (index < 3) {
      return {
        ...series,
        title: titles[index] ?? series.title,
        sampleCount: index === 2 ? throughput.length : samples.length,
        latestValue: formatAverage(averages[index], index === 2 ? "tok/s" : "ms"),
      }
    }

    return measured.length
      ? { ...series, sampleCount: measured.length }
      : {
          ...series,
          sampleCount: 0,
          latestValue: "—",
          tokenBreakdown: { inputTokens: "—", reasoningTokens: "—", outputTokens: "—" },
        }
  })
}

function average(values: number[]): number | undefined {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined
}

function formatAverage(value: number | undefined, unit: "ms" | "tok/s"): string {
  return value === undefined
    ? "—"
    : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} ${unit}`
}
