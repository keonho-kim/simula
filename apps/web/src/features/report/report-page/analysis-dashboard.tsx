import { useEffect, useMemo, useState } from "react"
import type { RunEvent } from "@simula/shared"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { UiTexts } from "@/lib/i18n"
import {
  buildReportMetrics,
  buildReportMetricsFromSamples,
  type ReportMetricKind,
  type ReportMetricSample,
  type ReportMetricsViewModel,
} from "../report-metrics-view-model"
import type { ReportAnalysisViewModel } from "../report-analysis-view-model"
import { DynamicsKpis, DynamicsSignalMap } from "./simulation-dynamics"
import { EmptyPanel } from "./ui"

interface TokenRange {
  inputMin: number
  inputMax: number
  outputMin: number
  outputMax: number
}

export function ReportAnalysisDashboard({
  events,
  model,
  t,
}: {
  events: RunEvent[]
  model: ReportAnalysisViewModel | undefined
  t: UiTexts
}) {
  const metrics = useMemo(() => buildReportMetrics(events), [events])
  const bounds = useMemo(() => tokenBounds(metrics.samples), [metrics.samples])
  const [rangeOverride, setRangeOverride] = useState<TokenRange>()
  const range = rangeOverride ?? bounds
  const filteredSamples = useMemo(() => filterSamplesByTokenRange(metrics.samples, range), [metrics.samples, range])
  const filteredMetrics = useMemo(() => buildReportMetricsFromSamples(filteredSamples), [filteredSamples])

  useEffect(() => {
    setRangeOverride(undefined)
  }, [bounds.inputMin, bounds.inputMax, bounds.outputMin, bounds.outputMax])

  if (!model) {
    return (
      <div className="p-4">
        <EmptyPanel title={t.noRunSelected} body={t.reportAnalysisNoRunDescription} />
      </div>
    )
  }

  return (
    <ScrollArea className="h-[calc(100svh-214px)] min-h-[560px] p-3">
      <div className="flex flex-col gap-3 pr-3">
        <ReportBriefing model={model} metrics={metrics} t={t} />
        <DynamicsSignalMap model={model} t={t} />
        <DynamicsKpis model={model} t={t} />
        <TokenRangeControls
          bounds={bounds}
          range={range}
          activeCount={filteredSamples.length}
          totalCount={metrics.samples.length}
          onChange={setRangeOverride}
          t={t}
        />
        <KpiStrip metrics={filteredMetrics} t={t} />
        <LlmMetricCharts metrics={filteredMetrics} t={t} />
      </div>
    </ScrollArea>
  )
}

function ReportBriefing({
  model,
  metrics,
  t,
}: {
  model: ReportAnalysisViewModel
  metrics: ReportMetricsViewModel
  t: UiTexts
}) {
  const summary = model.analysis.summary
  const network = model.analysis.network.summary
  const activeActorCount = model.analysis.network.actorMetrics.filter((actor) => actor.weightedDegree > 0).length
  const totalActorCount = model.analysis.network.actorMetrics.length
  const deliveryStats = [
    {
      label: t.reportBriefingInteractions,
      value: network.validActionCount.toLocaleString(),
      detail: t.reportBriefingInteractionsHelp,
    },
    {
      label: t.reportBriefingActiveActors,
      value: `${activeActorCount.toLocaleString()} / ${totalActorCount.toLocaleString()}`,
      detail: t.reportBriefingActiveActorsHelp,
    },
    {
      label: t.reportBriefingCompletedEvents,
      value: summary.totalEventCount ? `${summary.completedEventCount.toLocaleString()} / ${summary.totalEventCount.toLocaleString()}` : "-",
      detail: t.reportBriefingCompletedEventsHelp,
    },
  ]
  const intelligenceStats = [
    {
      label: t.actionDiversity,
      value: formatPercent(summary.averageActionEntropy),
      detail: t.actionDiversityHelp,
    },
    {
      label: t.coordinatorAlignment,
      value: formatPercent(summary.averageEventAlignment),
      detail: t.coordinatorAlignmentHelp,
    },
    {
      label: t.responseThroughput,
      value: formatMaybeNumber(metrics.averages.tokensPerSecond),
      detail: t.responseThroughputHelp,
    },
  ]

  return (
    <section className="grid gap-3 lg:grid-cols-2" aria-label={t.reportBriefing}>
      <BriefingPanel
        title={t.reportBriefingSimulation}
        description={t.reportBriefingSimulationDescription}
        stats={deliveryStats}
      />
      <BriefingPanel
        title={t.reportBriefingIntelligence}
        description={t.reportBriefingIntelligenceDescription}
        stats={intelligenceStats}
      />
    </section>
  )
}

function BriefingPanel({
  title,
  description,
  stats,
}: {
  title: string
  description: string
  stats: Array<{ label: string; value: string; detail: string }>
}) {
  return (
    <article className="rounded-md border border-border/70 bg-background p-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md bg-muted/25 p-2">
            <div className="text-[10px] font-semibold uppercase text-muted-foreground">{stat.label}</div>
            <div className="mt-1 font-mono text-lg font-semibold tabular-nums">{stat.value}</div>
            <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-muted-foreground">{stat.detail}</div>
          </div>
        ))}
      </div>
    </article>
  )
}

function TokenRangeControls({
  bounds,
  range,
  activeCount,
  totalCount,
  onChange,
  t,
}: {
  bounds: TokenRange
  range: TokenRange
  activeCount: number
  totalCount: number
  onChange: (range: TokenRange) => void
  t: UiTexts
}) {
  return (
    <section className="rounded-md border border-border/70 bg-card/90 p-3" aria-label={t.tokenRange}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold text-foreground">{t.tokenRange}</h2>
          <p className="mt-1 text-[10px] text-muted-foreground">{t.tokenRangeDescription}</p>
        </div>
        <div className="rounded-sm border border-border/60 bg-muted/30 px-2 py-1 font-mono text-[10px] tabular-nums text-muted-foreground">
          {activeCount.toLocaleString("en-US")} / {totalCount.toLocaleString("en-US")} {t.samples}
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <TokenInput
          label={`${t.inputTokens} ${t.minToken}`}
          value={range.inputMin}
          min={bounds.inputMin}
          max={bounds.inputMax}
          onChange={(value) => onChange(normalizeRange({ ...range, inputMin: value }, bounds))}
        />
        <TokenInput
          label={`${t.inputTokens} ${t.maxToken}`}
          value={range.inputMax}
          min={bounds.inputMin}
          max={bounds.inputMax}
          onChange={(value) => onChange(normalizeRange({ ...range, inputMax: value }, bounds))}
        />
        <TokenInput
          label={`${t.outputTokens} ${t.minToken}`}
          value={range.outputMin}
          min={bounds.outputMin}
          max={bounds.outputMax}
          onChange={(value) => onChange(normalizeRange({ ...range, outputMin: value }, bounds))}
        />
        <TokenInput
          label={`${t.outputTokens} ${t.maxToken}`}
          value={range.outputMax}
          min={bounds.outputMin}
          max={bounds.outputMax}
          onChange={(value) => onChange(normalizeRange({ ...range, outputMax: value }, bounds))}
        />
      </div>
    </section>
  )
}

function TokenInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <label className="grid gap-1 text-[10px] font-medium uppercase text-muted-foreground">
      <span>{label}</span>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        className="h-8 rounded-md border-border/70 bg-background font-mono text-xs tabular-nums"
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
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
              color: chartColor(chart.kind),
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
  series: Array<{ label: string; values: number[]; color: string }>
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
          <path d="M 0 33.5 H 100" className="stroke-border" strokeWidth="0.3" />
          <path d="M 0 22.5 H 100" stroke="var(--border)" strokeOpacity="0.7" strokeWidth="0.2" />
          <path d="M 0 11.5 H 100" stroke="var(--border)" strokeOpacity="0.7" strokeWidth="0.2" />
          {series.map((item) => (
            <path
              key={item.label}
              d={sparklinePath(item.values, max, width, height)}
              className="fill-none"
              stroke={item.color}
              strokeWidth="0.85"
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

function tokenBounds(samples: ReportMetricSample[]): TokenRange {
  if (!samples.length) {
    return { inputMin: 0, inputMax: 0, outputMin: 0, outputMax: 0 }
  }
  return {
    inputMin: Math.min(...samples.map((sample) => sample.inputTokens)),
    inputMax: Math.max(...samples.map((sample) => sample.inputTokens)),
    outputMin: Math.min(...samples.map((sample) => sample.outputTokens)),
    outputMax: Math.max(...samples.map((sample) => sample.outputTokens)),
  }
}

function filterSamplesByTokenRange(samples: ReportMetricSample[], range: TokenRange): ReportMetricSample[] {
  return samples.filter((sample) =>
    sample.inputTokens >= range.inputMin &&
    sample.inputTokens <= range.inputMax &&
    sample.outputTokens >= range.outputMin &&
    sample.outputTokens <= range.outputMax
  )
}

function normalizeRange(range: TokenRange, bounds: TokenRange): TokenRange {
  const inputMin = clampFinite(range.inputMin, bounds.inputMin, bounds.inputMax)
  const inputMax = clampFinite(range.inputMax, bounds.inputMin, bounds.inputMax)
  const outputMin = clampFinite(range.outputMin, bounds.outputMin, bounds.outputMax)
  const outputMax = clampFinite(range.outputMax, bounds.outputMin, bounds.outputMax)
  return {
    inputMin: Math.min(inputMin, inputMax),
    inputMax: Math.max(inputMin, inputMax),
    outputMin: Math.min(outputMin, outputMax),
    outputMax: Math.max(outputMin, outputMax),
  }
}

function clampFinite(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min
  }
  return Math.min(max, Math.max(min, Math.round(value)))
}

function chartColor(kind: ReportMetricKind): string {
  if (kind === "ttft") return "var(--chart-1)"
  if (kind === "duration") return "var(--chart-2)"
  return "var(--chart-3)"
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

function formatPercent(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "-"
  }
  return `${Math.round(value * 100)}%`
}

function average(values: number[]): number | undefined {
  const finite = values.filter(Number.isFinite)
  if (!finite.length) {
    return undefined
  }
  return finite.reduce((sum, value) => sum + value, 0) / finite.length
}
