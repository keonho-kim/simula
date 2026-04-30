import { useEffect, useMemo, useState } from "react"
import type { RunEvent } from "@simula/shared"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { UiTexts } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
  buildReportMetrics,
  type ReportMetricKind,
  type ReportMetricPoint,
  type ReportMetricsViewModel,
} from "../report-metrics-view-model"

const chartWidth = 100
const chartHeight = 40
const chartPadding = 4
const baselineY = chartHeight - chartPadding
const metricKinds: ReportMetricKind[] = ["ttft", "duration", "tokensPerSecond"]

export function ReportMetricsDashboard({ events, t }: { events: RunEvent[]; t: UiTexts }) {
  const metrics = useMemo(() => buildReportMetrics(events), [events])

  return (
    <section className="overflow-hidden rounded-lg bg-card/80 shadow-sm ring-1 ring-border/60" aria-label={t.reportMetrics}>
      <Tabs defaultValue="global" className="gap-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-2">
          <div>
            <h2 className="font-heading text-sm font-semibold">{t.reportMetrics}</h2>
            <p className="text-xs text-muted-foreground">{t.reportMetricsDescription}</p>
          </div>
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="global" className="text-xs">{t.globalAvg}</TabsTrigger>
            <TabsTrigger value="charts" className="text-xs">{t.charts}</TabsTrigger>
            <TabsTrigger value="matrix" className="text-xs">{t.inputOutputUsage}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="global" className="p-3">
          <GlobalAveragePanel metrics={metrics} t={t} />
        </TabsContent>
        <TabsContent value="charts" className="p-3">
          <ChartsPanel metrics={metrics} t={t} />
        </TabsContent>
        <TabsContent value="matrix" className="p-3">
          <UsageMatrixPanel metrics={metrics} t={t} />
        </TabsContent>
      </Tabs>
    </section>
  )
}

function GlobalAveragePanel({ metrics, t }: { metrics: ReportMetricsViewModel; t: UiTexts }) {
  return (
    <div className="grid min-h-[112px] gap-3 md:grid-cols-3">
      {metricKinds.map((kind) => (
        <AverageCard
          key={kind}
          label={averageLabel(kind, t)}
          value={metrics.averages[kind]}
          unit={metricUnit(kind)}
          formatter={(value) => formatMetricValue(kind, value)}
          emptyLabel={t.noMetricSamples}
        />
      ))}
    </div>
  )
}

function AverageCard({
  label,
  value,
  unit,
  formatter,
  emptyLabel,
}: {
  label: string
  value: number | undefined
  unit: string
  formatter: (value: number) => string
  emptyLabel: string
}) {
  return (
    <article className="flex min-h-[112px] flex-col justify-between rounded-md border border-border/70 bg-background px-4 py-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {value === undefined ? (
        <div className="font-mono text-2xl text-muted-foreground">{emptyLabel}</div>
      ) : (
        <div className="flex items-end justify-between gap-3">
          <SlotNumber value={value} formatter={formatter} />
          <span className="pb-1 text-xs uppercase text-muted-foreground">{unit}</span>
        </div>
      )}
    </article>
  )
}

function SlotNumber({ value, formatter }: { value: number; formatter: (value: number) => string }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const startedAt = performance.now()
    const duration = 720
    let frame = 0

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - (1 - progress) ** 3
      setDisplayValue(value * eased)
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick)
      }
    }

    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [value])

  return (
    <div className="overflow-hidden font-mono text-4xl font-semibold leading-none tabular-nums text-[#0284a8]">
      <span className="inline-block animate-in slide-in-from-bottom-1 duration-300">{formatter(displayValue)}</span>
    </div>
  )
}

function ChartsPanel({ metrics, t }: { metrics: ReportMetricsViewModel; t: UiTexts }) {
  return (
    <div className="grid min-h-[112px] gap-3 lg:grid-cols-3">
      {metricKinds.map((kind) => (
        <article key={kind} className="rounded-md border border-border/70 bg-background p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="truncate text-xs font-medium text-muted-foreground">{metricLabel(kind, t)}</h3>
            <span className="font-mono text-xs text-[#0284a8]">{formatMaybeMetric(kind, metrics.series[kind].at(-1)?.value)}</span>
          </div>
          <LineChart id={`report-${kind}`} points={metrics.series[kind]} emptyLabel={t.noMetricSamples} />
        </article>
      ))}
    </div>
  )
}

function LineChart({ id, points, emptyLabel }: { id: string; points: ReportMetricPoint[]; emptyLabel: string }) {
  const safeId = id.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const path = buildLinePath(points)
  const areaPath = path ? `${path} L ${lastX(points.length)} ${baselineY} L ${firstX(points.length)} ${baselineY} Z` : ""
  const latest = points.at(-1)

  return (
    <div className="relative h-[72px] overflow-hidden rounded-sm border border-border/70 bg-card">
      <svg className="h-full w-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
        <defs>
          <pattern id={`report-grid-${safeId}`} width="10" height="8" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 8" fill="none" stroke="#d8e0e4" strokeWidth="0.35" />
          </pattern>
          <linearGradient id={`report-fill-${safeId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2dbbd3" stopOpacity="0.36" />
            <stop offset="100%" stopColor="#2dbbd3" stopOpacity="0.06" />
          </linearGradient>
        </defs>
        <rect width={chartWidth} height={chartHeight} fill={`url(#report-grid-${safeId})`} />
        {areaPath ? <path d={areaPath} fill={`url(#report-fill-${safeId})`} /> : null}
        {path ? <path d={path} fill="none" stroke="#0891b2" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {latest ? <circle cx={lastX(points.length)} cy={valueY(points, latest.value)} r="1.7" fill="#06b6d4" /> : null}
      </svg>
      {!points.length ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">{emptyLabel}</div>
      ) : null}
    </div>
  )
}

function UsageMatrixPanel({ metrics, t }: { metrics: ReportMetricsViewModel; t: UiTexts }) {
  return (
    <Tabs defaultValue="ttft" className="min-h-[112px] gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">{t.outputTokens} x {t.inputTokens}</div>
        <TabsList className="grid grid-cols-3">
          {metricKinds.map((kind) => (
            <TabsTrigger key={kind} value={kind} className="text-xs">{metricLabel(kind, t)}</TabsTrigger>
          ))}
        </TabsList>
      </div>
      {metricKinds.map((kind) => (
        <TabsContent key={kind} value={kind} className="min-h-0">
          <MetricMatrix metrics={metrics} kind={kind} t={t} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function MetricMatrix({ metrics, kind, t }: { metrics: ReportMetricsViewModel; kind: ReportMetricKind; t: UiTexts }) {
  return (
    <div className="grid grid-cols-[56px_repeat(4,minmax(0,1fr))] overflow-hidden rounded-md border border-border/70 bg-background text-xs">
      <div className="border-r border-b border-border/60 bg-muted/40 px-2 py-1 text-muted-foreground">{t.outputTokens}</div>
      {metrics.binLabels.map((label) => (
        <div key={label} className="border-b border-border/60 bg-muted/40 px-2 py-1 text-center text-muted-foreground">{label}</div>
      ))}
      {metrics.matrix[kind].map((row, rowIndex) => (
        <MatrixRow key={metrics.binLabels[rowIndex]} row={row} rowLabel={metrics.binLabels[rowIndex] ?? ""} kind={kind} />
      ))}
    </div>
  )
}

function MatrixRow({
  row,
  rowLabel,
  kind,
}: {
  row: ReportMetricsViewModel["matrix"][ReportMetricKind][number]
  rowLabel: string
  kind: ReportMetricKind
}) {
  return (
    <>
      <div className="border-r border-border/60 bg-muted/30 px-2 py-1.5 text-muted-foreground">{rowLabel}</div>
      {row.map((cell, index) => (
        <div
          key={`${rowLabel}-${index}`}
          className={cn(
            "min-h-8 border-border/60 px-2 py-1.5 text-center font-mono tabular-nums",
            index < row.length - 1 && "border-r",
            cell.value === undefined ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {formatMaybeMetric(kind, cell.value)}
        </div>
      ))}
    </>
  )
}

function averageLabel(kind: ReportMetricKind, t: UiTexts): string {
  if (kind === "ttft") return t.averageTtft
  if (kind === "duration") return t.averageDuration
  return t.averageTokensPerSecond
}

function metricLabel(kind: ReportMetricKind, t: UiTexts): string {
  if (kind === "ttft") return t.ttft
  if (kind === "duration") return t.duration
  return t.tokensPerSecond
}

function metricUnit(kind: ReportMetricKind): string {
  return kind === "tokensPerSecond" ? "tok/s" : "ms"
}

function formatMaybeMetric(kind: ReportMetricKind, value: number | undefined): string {
  return value === undefined ? "-" : formatMetricValue(kind, value)
}

function formatMetricValue(kind: ReportMetricKind, value: number): string {
  if (kind === "tokensPerSecond") {
    return value.toLocaleString("en-US", { maximumFractionDigits: 1 })
  }
  return Math.round(value).toLocaleString("en-US")
}

function buildLinePath(points: ReportMetricPoint[]): string {
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

function valueY(points: ReportMetricPoint[], value: number): number {
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
