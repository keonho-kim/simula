import type { RunEvent } from "@simula/shared"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { UiTexts } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { buildReportMetrics, type ReportMetricKind, type ReportMetricsViewModel } from "../report-metrics-view-model"
import type { ReportAnalysisViewModel } from "../report-analysis-view-model"
import { EmptyPanel } from "./ui"

export function ReportAnalysisDashboard({
  events,
  model,
  t,
}: {
  events: RunEvent[]
  model: ReportAnalysisViewModel | undefined
  t: UiTexts
}) {
  if (!model) {
    return (
      <div className="p-4">
        <EmptyPanel title={t.noRunSelected} body={t.reportAnalysisNoRunDescription} />
      </div>
    )
  }
  const metrics = buildReportMetrics(events)

  return (
    <ScrollArea className="h-[calc(100svh-214px)] min-h-[560px] p-3">
      <div className="flex flex-col gap-3 pr-3">
        <KpiStrip metrics={metrics} t={t} />
        <LlmMetricCharts metrics={metrics} t={t} />
      </div>
    </ScrollArea>
  )
}

function KpiStrip({ metrics, t }: { metrics: ReportMetricsViewModel; t: UiTexts }) {
  const cards = [
    { label: t.averageTtft, value: formatMaybeNumber(metrics.averages.ttft, "ms") },
    { label: t.averageDuration, value: formatMaybeNumber(metrics.averages.duration, "ms") },
    { label: t.averageTokensPerSecond, value: formatMaybeNumber(metrics.averages.tokensPerSecond) },
    { label: t.inputTokens, value: formatMaybeNumber(average(metrics.samples.map((sample) => sample.inputTokens))) },
    { label: t.outputTokens, value: formatMaybeNumber(average(metrics.samples.map((sample) => sample.outputTokens))) },
    { label: t.samples, value: metrics.samples.length.toLocaleString() },
  ]

  return (
    <section className="grid gap-3 md:grid-cols-3 2xl:grid-cols-6" aria-label={t.analysisKpis}>
      {cards.map((card) => (
        <article key={card.label} className="rounded-md border border-border/70 bg-background p-3">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">{card.label}</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">
            {card.value}
          </div>
        </article>
      ))}
    </section>
  )
}

function LlmMetricCharts({ metrics, t }: { metrics: ReportMetricsViewModel; t: UiTexts }) {
  const charts: Array<{ kind: ReportMetricKind; label: string }> = [
    { kind: "ttft", label: t.ttft },
    { kind: "duration", label: t.duration },
    { kind: "tokensPerSecond", label: t.tokensPerSecond },
  ]
  return (
    <section className="grid gap-3 lg:grid-cols-3" aria-label={t.reportMetrics}>
      {charts.map((chart) => (
        <article key={chart.kind} className="rounded-md border border-border/70 bg-background p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="truncate text-xs font-semibold text-muted-foreground">{chart.label}</h3>
            <span className="font-mono text-xs tabular-nums">{formatMaybeMetric(chart.kind, metrics.series[chart.kind].at(-1)?.value)}</span>
          </div>
          <Sparkline
            emptyLabel={t.noMetricSamples}
            series={[{
              label: chart.label,
              values: metrics.series[chart.kind].map((point) => point.value),
              className: "stroke-primary",
            }]}
          />
        </article>
      ))}
    </section>
  )
}

function Sparkline({
  series,
  emptyLabel,
}: {
  series: Array<{ label: string; values: number[]; className: string }>
  emptyLabel?: string
}) {
  const width = 100
  const height = 34
  const hasValues = series.some((item) => item.values.length > 0)
  const max = Math.max(1, ...series.flatMap((item) => item.values))
  return (
    <div className="rounded-md border border-border/70 bg-card p-3">
      <div className="relative h-[104px]">
        <svg className="h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <path d="M 0 33.5 H 100" className="stroke-border" strokeWidth="0.4" />
          {series.map((item) => (
            <path
              key={item.label}
              d={sparklinePath(item.values, max, width, height)}
              className={cn("fill-none", item.className)}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
        {!hasValues && emptyLabel ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">{emptyLabel}</div>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {series.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  )
}

function sparklinePath(values: number[], max: number, width: number, height: number): string {
  if (!values.length) {
    return ""
  }
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width : (index / (values.length - 1)) * width
      const y = height - 2 - (value / max) * (height - 4)
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(" ")
}

function formatMaybeNumber(value: number | undefined, suffix = ""): string {
  if (value === undefined) {
    return "-"
  }
  return `${Math.round(value).toLocaleString("en-US")}${suffix}`
}

function formatMaybeMetric(kind: ReportMetricKind, value: number | undefined): string {
  if (value === undefined) {
    return "-"
  }
  if (kind === "tokensPerSecond") {
    return value.toLocaleString("en-US", { maximumFractionDigits: 1 })
  }
  return Math.round(value).toLocaleString("en-US")
}

function average(values: number[]): number | undefined {
  const finite = values.filter(Number.isFinite)
  if (!finite.length) {
    return undefined
  }
  return finite.reduce((sum, value) => sum + value, 0) / finite.length
}
