/**
 * Purpose: Incrementally aggregate model calls into the four report metric cards.
 * Pattern: Pure Reducer.
 * Usage: ReportMetricOverview appends only newly received calls before rendering series.
 * Related: src/ui/models/metrics/metric-series.ts, src/ui/components/report/metric-overview.tsx
 */
import type { RunEvent } from "@/shared"
import type { UiTexts } from "@/ui/types/i18n"
import { emptyMetricData, type MetricData } from "@/ui/models/metrics/metric-data"
import { buildMetricSeries, type MetricSeries } from "@/ui/models/metrics/metric-series"
import { appendMetricHistory, type MetricPoint } from "@/ui/models/metrics/sample-history"

export interface ReportMetricSummary {
  data: MetricData
  count: number
  providerCount: number
  throughputCount: number
  ttftTotal: number
  durationTotal: number
  throughputTotal: number
}

export function emptyReportMetricSummary(): ReportMetricSummary {
  return { data: emptyMetricData(), count: 0, providerCount: 0, throughputCount: 0,
    ttftTotal: 0, durationTotal: 0, throughputTotal: 0 }
}

export function appendReportMetricSummary(previous: ReportMetricSummary, events: RunEvent[]): ReportMetricSummary {
  const samples = events.filter((event): event is Extract<RunEvent, { type: "model.metrics" }> => event.type === "model.metrics")
  if (!samples.length) return previous
  const ttft: MetricPoint[] = []
  const duration: MetricPoint[] = []
  const throughput: MetricPoint[] = []
  let providerCount = previous.providerCount
  let ttftTotal = previous.ttftTotal
  let durationTotal = previous.durationTotal
  let throughputTotal = previous.throughputTotal
  let totalTokens = previous.data.totalTokens
  let inputTokens = previous.data.inputTokens
  let reasoningTokens = previous.data.reasoningTokens
  let outputTokens = previous.data.outputTokens
  for (const { timestamp, metrics } of samples) {
    ttft.push({ timestamp, value: metrics.ttftMs })
    duration.push({ timestamp, value: metrics.durationMs })
    ttftTotal += metrics.ttftMs
    durationTotal += metrics.durationMs
    if (metrics.tokenSource !== "provider") continue
    providerCount += 1
    totalTokens += metrics.totalTokens
    inputTokens += metrics.inputTokens
    reasoningTokens += metrics.reasoningTokens
    outputTokens += metrics.outputTokens
    if (metrics.durationMs > 0) {
      const value = metrics.totalTokens / metrics.durationMs * 1_000
      throughput.push({ timestamp, value })
      throughputTotal += value
    }
  }
  const data = {
    ttft: appendMetricHistory(previous.data.ttft, ttft),
    duration: appendMetricHistory(previous.data.duration, duration),
    tokensPerSecond: appendMetricHistory(previous.data.tokensPerSecond, throughput),
    totalTokens, inputTokens, reasoningTokens, outputTokens,
  }
  return { data, count: previous.count + samples.length, providerCount,
    throughputCount: previous.throughputCount + throughput.length,
    ttftTotal, durationTotal, throughputTotal }
}

export function reportMetricSeries(summary: ReportMetricSummary, t: UiTexts): MetricSeries[] {
  const averages = [
    average(summary.ttftTotal, summary.count),
    average(summary.durationTotal, summary.count),
    average(summary.throughputTotal, summary.throughputCount),
  ]
  const titles = [t.averageTtft, t.averageDuration, t.averageTokensPerSecond]
  return buildMetricSeries(summary.data, t).map((series, index) => {
    if (index < 3) return { ...series, title: titles[index] ?? series.title,
      sampleCount: index === 2 ? summary.throughputCount : summary.count,
      latestValue: formatAverage(averages[index], index === 2 ? "tok/s" : "ms") }
    return summary.providerCount
      ? { ...series, sampleCount: summary.providerCount }
      : { ...series, sampleCount: 0, latestValue: "—",
          tokenBreakdown: { inputTokens: "—", reasoningTokens: "—", outputTokens: "—" } }
  })
}

export function buildReportMetricSeries(events: RunEvent[], t: UiTexts): MetricSeries[] {
  return reportMetricSeries(appendReportMetricSummary(emptyReportMetricSummary(), events), t)
}

function average(total: number, count: number): number | undefined {
  return count ? total / count : undefined
}

function formatAverage(value: number | undefined, unit: "ms" | "tok/s"): string {
  return value === undefined ? "—" : `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })} ${unit}`
}
