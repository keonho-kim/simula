import { useMemo } from "react"
import type { RunEvent } from "@simula/shared"
import type { UiTexts } from "@/lib/i18n"
import { useRunStore } from "@/store/run-store"

interface MetricPoint {
  timestamp: string
  value: number
}

interface MetricSeries {
  title: string
  unit: string
  points: MetricPoint[]
  latestValue: string
  display: "chart" | "total"
}

const chartWidth = 100
const chartHeight = 42
const chartPadding = 3
const baselineY = chartHeight - chartPadding

export function LlmMetricsPanel({ t }: { t: UiTexts }) {
  const events = useRunStore((state) => state.liveEvents)
  const series = useMemo(() => buildMetricSeries(events, t), [events, t])

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t.llmMetrics}>
      {series.map((item) => (
        <MetricPanel key={item.title} series={item} t={t} />
      ))}
    </section>
  )
}

function MetricPanel({ series, t }: { series: MetricSeries; t: UiTexts }) {
  const hasSamples = series.points.length > 0
  const isTotal = series.display === "total"
  return (
    <article className="overflow-hidden rounded-md border border-border/70 bg-card text-card-foreground shadow-sm">
      <div className="flex min-h-[128px] min-w-0 flex-col gap-2 p-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h2 className="truncate text-sm font-medium">{series.title}</h2>
          <span className="shrink-0 text-[10px] text-muted-foreground">{hasSamples ? t.metricLive : t.metricIdle}</span>
        </div>
        {isTotal ? (
          <div className="flex min-h-14 flex-1 items-center justify-end rounded-sm border border-border/70 bg-background px-3">
            <div className="truncate font-mono text-3xl leading-none text-[#0284a8]">{series.latestValue}</div>
          </div>
        ) : (
          <LineChart id={series.title} points={series.points} t={t} />
        )}
        <div className={isTotal ? "hidden" : "border-t border-border/60 pt-2 text-right"}>
          <div className="truncate font-mono text-lg leading-none text-[#0284a8]">{series.latestValue}</div>
        </div>
      </div>
    </article>
  )
}

function LineChart({ id, points, t }: { id: string; points: MetricPoint[]; t: UiTexts }) {
  const safeId = id.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const path = buildLinePath(points)
  const areaPath = path ? `${path} L ${lastX(points.length)} ${baselineY} L ${firstX(points.length)} ${baselineY} Z` : ""
  const latest = points.at(-1)

  return (
    <div className="relative h-14 overflow-hidden rounded-sm border border-border/70 bg-background">
      <svg className="h-full w-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
        <defs>
          <pattern id={`metric-grid-${safeId}`} width="10" height="7" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 7" fill="none" stroke="#d8e0e4" strokeWidth="0.35" />
          </pattern>
          <linearGradient id={`metric-fill-${safeId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2dbbd3" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#2dbbd3" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <rect width={chartWidth} height={chartHeight} fill={`url(#metric-grid-${safeId})`} />
        {areaPath ? <path d={areaPath} fill={`url(#metric-fill-${safeId})`} /> : null}
        {path ? <path d={path} fill="none" stroke="#0891b2" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {latest ? <circle cx={lastX(points.length)} cy={valueY(points, latest.value)} r="1.7" fill="#06b6d4" /> : null}
      </svg>
      {!points.length ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">{t.metricNoSamples}</div>
      ) : null}
    </div>
  )
}

function buildMetricSeries(events: RunEvent[], t: UiTexts): MetricSeries[] {
  const metricEvents = events.filter((event): event is Extract<RunEvent, { type: "model.metrics" }> => event.type === "model.metrics")
  const ttft: MetricPoint[] = []
  const duration: MetricPoint[] = []
  const tokensPerSecond: MetricPoint[] = []
  const totalTokens: MetricPoint[] = []
  let cumulativeTokens = 0

  for (const event of metricEvents) {
    const timestamp = event.timestamp
    const metrics = event.metrics
    const tokensPerSecondValue = metrics.durationMs > 0 ? (metrics.totalTokens / metrics.durationMs) * 1000 : 0
    cumulativeTokens += metrics.totalTokens

    ttft.push({ timestamp, value: metrics.ttftMs })
    duration.push({ timestamp, value: metrics.durationMs })
    tokensPerSecond.push({ timestamp, value: tokensPerSecondValue })
    totalTokens.push({ timestamp, value: cumulativeTokens })
  }

  return [
    {
      title: "TTFT",
      unit: "ms",
      points: ttft,
      latestValue: formatLatest(ttft, "ms"),
      display: "chart",
    },
    {
      title: t.metricDuration,
      unit: "ms",
      points: duration,
      latestValue: formatLatest(duration, "ms"),
      display: "chart",
    },
    {
      title: t.metricTokensPerSecond,
      unit: "tps",
      points: tokensPerSecond,
      latestValue: formatLatest(tokensPerSecond, "tps"),
      display: "chart",
    },
    {
      title: t.metricTotalTokens,
      unit: "tokens",
      points: totalTokens,
      latestValue: formatLatest(totalTokens, "tokens"),
      display: "total",
    },
  ]
}

function formatLatest(points: MetricPoint[], unit: string): string {
  const latest = points.at(-1)?.value ?? 0
  if (unit === "ms") {
    return `${Math.round(latest).toLocaleString("en-US")} ms`
  }
  if (unit === "tps") {
    return `${latest.toLocaleString("en-US", { maximumFractionDigits: 1 })} tok/s`
  }
  return latest.toLocaleString("en-US")
}

function buildLinePath(points: MetricPoint[]): string {
  if (!points.length) {
    return ""
  }
  return points
    .map((point, index) => {
      const x = xForIndex(index, points.length)
      const y = valueY(points, point.value)
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")
}

function valueY(points: MetricPoint[], value: number): number {
  const values = points.map((point) => point.value).filter(Number.isFinite)
  const max = Math.max(...values, 0)
  if (max <= 0) {
    return baselineY
  }
  const usableHeight = chartHeight - chartPadding * 2
  return baselineY - (value / max) * usableHeight
}

function firstX(length: number): number {
  return xForIndex(0, length)
}

function lastX(length: number): number {
  return xForIndex(Math.max(0, length - 1), length)
}

function xForIndex(index: number, length: number): number {
  if (length <= 1) {
    return chartWidth - chartPadding
  }
  const usableWidth = chartWidth - chartPadding * 2
  return chartPadding + (index / (length - 1)) * usableWidth
}
