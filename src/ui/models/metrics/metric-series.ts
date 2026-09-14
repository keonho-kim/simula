import { latestMetricPoint, type MetricHistory } from "./sample-history"
import type { MetricData } from "./metric-data"
import type { UiTexts } from "@/ui/types/i18n"

export interface MetricSeries {
  title: string
  unit: string
  points?: MetricHistory
  sampleCount: number
  latestValue: string
  display: "chart" | "total"
  tokenBreakdown?: {
    inputTokens: string
    reasoningTokens: string
    outputTokens: string
  }
}

export function buildMetricSeries(data: MetricData, t: UiTexts): MetricSeries[] {
  const { ttft, duration, tokensPerSecond, totalTokens } = data

  return [
    {
      title: "TTFT",
      unit: "ms",
      points: ttft,
      sampleCount: ttft.length,
      latestValue: formatLatest(ttft, "ms"),
      display: "chart",
    },
    {
      title: t.metricDuration,
      unit: "ms",
      points: duration,
      sampleCount: duration.length,
      latestValue: formatLatest(duration, "ms"),
      display: "chart",
    },
    {
      title: t.metricTokensPerSecond,
      unit: "tps",
      points: tokensPerSecond,
      sampleCount: tokensPerSecond.length,
      latestValue: formatLatest(tokensPerSecond, "tps"),
      display: "chart",
    },
    {
      title: t.metricTotalTokens,
      unit: "tokens",
      sampleCount: ttft.length,
      latestValue: totalTokens.toLocaleString("en-US"),
      display: "total",
      tokenBreakdown: {
        inputTokens: data.inputTokens.toLocaleString("en-US"),
        reasoningTokens: data.reasoningTokens.toLocaleString("en-US"),
        outputTokens: data.outputTokens.toLocaleString("en-US"),
      },
    },
  ]
}

function formatLatest(points: MetricHistory, unit: string): string {
  const latest = latestMetricPoint(points)?.value ?? 0
  if (unit === "ms") {
    return `${Math.round(latest).toLocaleString("en-US")} ms`
  }
  if (unit === "tps") {
    return `${latest.toLocaleString("en-US", { maximumFractionDigits: 1 })} tok/s`
  }
  return latest.toLocaleString("en-US")
}
