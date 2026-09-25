/**
 * Purpose: Render live and report-context LLM metric cards from prepared series.
 * Pattern: Presentation Component.
 * Usage: Imported by the simulation dashboard and Report metric overview.
 * Related: src/ui/models/metrics/metric-series.ts, src/ui/components/metrics/line-chart.tsx
 */
import { memo, useMemo } from "react"
import type { MetricData } from "@/ui/models/metrics/metric-data"
import type { UiTexts } from "@/ui/types/i18n"
import { useRunStore } from "@/ui/stores/run-store"
import { buildMetricSeries, type MetricSeries } from "@/ui/models/metrics/metric-series"
import { LineChart } from "@/ui/components/metrics/line-chart"

export const LlmMetricsPanel = memo(function LlmMetricsPanel({ t }: { t: UiTexts }) {
  const data = useRunStore((state) => state.metricData)

  return <LlmMetricsPanelView data={data} t={t} />
})

export function LlmMetricsPanelView({ data, t }: { data: MetricData; t: UiTexts }) {
  const series = useMemo(() => buildMetricSeries(data, t), [data, t])

  return (
    <section className="flex flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-[1_1_240px]" aria-label={t.llmMetrics}>
      {series.map((item) => (
        <MetricPanel key={item.title} series={item} t={t} />
      ))}
    </section>
  )
}

export function MetricPanel({
  series,
  t,
  context = "live",
}: {
  series: MetricSeries
  t: UiTexts
  context?: "live" | "report"
}) {
  const hasSamples = series.sampleCount > 0
  const isTotal = series.display === "total"
  const status = context === "report"
    ? `${series.sampleCount.toLocaleString()} ${t.samples}`
    : hasSamples ? t.metricLive : t.metricIdle
  return (
    <article className="overflow-hidden rounded-md border border-border/70 bg-card text-card-foreground shadow-sm">
      <div className="flex min-h-[128px] min-w-0 flex-col gap-2 p-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h2 className="truncate text-sm font-medium">{series.title}</h2>
          <span className="shrink-0 text-[10px] text-muted-foreground">{status}</span>
        </div>
        {isTotal ? (
          <TokenTotalPanel series={series} t={t} />
        ) : (
          series.points ? <LineChart id={series.title} points={series.points} t={t} /> : null
        )}
        <div className={isTotal ? "hidden" : "border-t border-border/60 pt-2 text-right"}>
          <div className={`truncate font-mono leading-none text-[#0284a8] ${context === "report" ? "text-2xl" : "text-lg"}`}>
            {series.latestValue}
          </div>
        </div>
      </div>
    </article>
  )
}

function TokenTotalPanel({ series, t }: { series: MetricSeries; t: UiTexts }) {
  return (
    <div className="flex min-h-14 flex-1 flex-col justify-between gap-2 rounded-sm border border-border/70 bg-background px-3 py-2">
      <div className="flex min-h-9 items-center justify-end">
        <div className="truncate font-mono text-3xl leading-none text-[#0284a8]">{series.latestValue}</div>
      </div>
      <div className="flex gap-2 border-t border-border/60 pt-2 [&>*]:min-w-0 [&>*]:flex-1">
        <TokenSubStat label={t.metricInputTokens} value={series.tokenBreakdown?.inputTokens ?? "0"} />
        <TokenSubStat label={t.metricReasoningTokens} value={series.tokenBreakdown?.reasoningTokens ?? "0"} />
        <TokenSubStat label={t.metricOutputTokens} value={series.tokenBreakdown?.outputTokens ?? "0"} />
      </div>
    </div>
  )
}

function TokenSubStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[10px] font-medium uppercase text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-sm tabular-nums text-foreground">{value}</div>
    </div>
  )
}
