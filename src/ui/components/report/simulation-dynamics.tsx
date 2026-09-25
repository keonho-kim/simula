/**
 * Purpose: Present relationship, round, and behavior metrics within the report.
 * Pattern: Read-only report presentation.
 * Usage: Rendered by the report relationship panel.
 * Related: src/ui/components/report/relationship-panel.tsx
 */
import type { ReactNode } from "react"
import { ActivityIcon, CircleHelpIcon, WaypointsIcon } from "lucide-react"
import { Badge } from "@/ui/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/components/ui/tooltip"
import type { UiTexts } from "@/ui/types/i18n"
import type { ReportAnalysisViewModel } from "@/ui/models/report/report-analysis-view-model"
import { EmptyPanel } from "./presentation"

export function RelationshipHeatmap({ model, t }: { model: ReportAnalysisViewModel; t: UiTexts }) {
  const columnCount = model.heatmapActors.length + 1
  return (
    <section className="rounded-md border border-border/70 bg-background/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle title={t.relationshipHeatmap} help={t.relationshipStructureDescription} icon={<WaypointsIcon data-icon="inline-start" />} />
        <Badge variant="outline" className="rounded-sm">
          {model.analysis.network.summary.reciprocalPairCount} {t.reciprocalDyads}
        </Badge>
      </div>
      {model.heatmapRows.length ? (
        <div className="mt-3 min-w-0">
          <div
            className="grid min-w-0 rounded-md border border-border/70 text-[10px]"
            style={{ gridTemplateColumns: `minmax(72px, 1.5fr) repeat(${Math.max(1, columnCount - 1)}, minmax(0, 1fr))` }}
          >
            <div className="border-r border-b border-border/60 bg-muted/40 px-2 py-1 text-muted-foreground">{t.actor}</div>
            {model.heatmapActors.map((actor) => (
              <div key={actor.actorId} title={actor.actorName} className="min-w-0 break-all border-b border-border/60 bg-muted/40 px-1 py-1 text-center text-muted-foreground">
                {actor.actorName}
              </div>
            ))}
            {model.heatmapRows.map((row) => (
              <HeatmapRow key={row.actorId} row={row} max={model.maxRelationshipWeight} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyPanel title={t.noAnalysisData} body={t.noAnalysisDataDescription} compact />
      )}
    </section>
  )
}

function HeatmapRow({ row, max }: { row: ReportAnalysisViewModel["heatmapRows"][number]; max: number }) {
  return (
    <>
      <div title={row.actorName} className="min-w-0 break-all border-r border-border/60 bg-muted/30 px-1 py-1.5 text-muted-foreground">{row.actorName}</div>
      {row.cells.map((value, index) => {
        const intensity = max > 0 ? value / max : 0
        return (
          <div
            key={`${row.actorId}-${index}`}
            className="min-h-8 border-r border-border/40 px-2 py-1.5 text-center font-mono tabular-nums last:border-r-0"
            style={{ backgroundColor: intensity ? `color-mix(in srgb, var(--primary) ${Math.round(8 + intensity * 34)}%, transparent)` : undefined }}
          >
            {value || "-"}
          </div>
        )
      })}
    </>
  )
}

export function RoundEvolution({ model, t }: { model: ReportAnalysisViewModel; t: UiTexts }) {
  const rounds = model.analysis.network.roundMetrics
  if (!rounds.length) {
    return <EmptyPanel title={t.noAnalysisData} body={t.noAnalysisDataDescription} compact />
  }
  return (
    <section className="rounded-md border border-border/70 bg-background/80 p-3">
      <SectionTitle title={t.roundEvolution} help={t.roundEvolutionDescription} icon={<ActivityIcon data-icon="inline-start" />} />
      <div className="mt-3 flex flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-[1_1_280px]">
        <Sparkline
          series={[
            { label: t.actions, values: rounds.map((round) => round.actionCount), color: "var(--chart-1)" },
            { label: t.activeActors, values: rounds.map((round) => round.activeActorCount), color: "var(--chart-2)" },
            { label: t.newTies, values: rounds.map((round) => round.newTies), color: "var(--chart-3)" },
          ]}
        />
        <div className="flex flex-wrap gap-2 [&>*]:min-w-0 [&>*]:flex-[1_1_120px]">
          <MiniMetric label={t.rounds} value={rounds.length.toLocaleString()} />
          <MiniMetric label={t.newTies} value={rounds.reduce((total, round) => total + round.newTies, 0).toLocaleString()} />
          <MiniMetric label={t.activeActors} value={Math.max(...rounds.map((round) => round.activeActorCount)).toLocaleString()} />
        </div>
      </div>
    </section>
  )
}

export function BehaviorRanking({ model, t }: { model: ReportAnalysisViewModel; t: UiTexts }) {
  return (
    <section className="rounded-md border border-border/70 bg-background/80 p-3">
      <SectionTitle title={t.behaviorDiversity} help={t.behaviorDiversityHelp} icon={<ActivityIcon data-icon="inline-start" />} />
      <div className="mt-3 flex flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-[1_1_320px]">
        {model.behaviorRanking.length ? (
          model.behaviorRanking.map((actor) => (
            <article key={actor.actorId} className="rounded-md bg-muted/25 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="truncate text-xs font-semibold">{actor.actorName}</h4>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {actor.actionCount} {t.actions} · {actor.uniqueActionTypes} {t.actionTypes}
                  </p>
                </div>
                <Badge variant="outline" className="rounded-sm">
                  {formatPercent(nonRepeatDiversity(actor.consecutiveRepeatRate))} {t.repeatRate}
                </Badge>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <MetricBar label={t.actionDiversity} help={t.actionDiversityHelp} value={actor.normalizedActionTypeEntropy} max={1} percent />
                <MetricBar label={t.visibilityDiversity} help={t.visibilityDiversityHelp} value={actor.normalizedVisibilityEntropy} max={1} percent />
                <MetricBar label={t.targetSpread} help={t.targetSpreadHelp} value={actor.targetSpread} max={1} percent />
              </div>
            </article>
          ))
        ) : (
          <EmptyPanel title={t.noAnalysisData} body={t.noAnalysisDataDescription} compact />
        )}
      </div>
    </section>
  )
}

function SectionTitle({ title, help, icon }: { title: string; help: string; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="truncate text-xs font-semibold">{title}</h3>
      </div>
      <InfoTip label={title} body={help} />
    </div>
  )
}

function InfoTip({ label, body }: { label: string; body: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          aria-label={`${label}: ${body}`}
        >
          <CircleHelpIcon className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px]">
        {body}
      </TooltipContent>
    </Tooltip>
  )
}

function MetricBar({
  label,
  help,
  detail,
  value,
  max,
  percent = false,
}: {
  label: string
  help: string
  detail?: string
  value: number
  max: number
  percent?: boolean
}) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium text-muted-foreground">{label}</span>
          <InfoTip label={label} body={help} />
        </div>
        <span className="font-mono tabular-nums text-foreground">{percent ? formatPercent(value) : value.toLocaleString()}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-muted">
        <div className="h-full rounded-sm bg-primary" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      {detail ? <div className="mt-1 truncate text-[10px] text-muted-foreground">{detail}</div> : null}
    </div>
  )
}

function MiniMetric({ label, value, help }: { label: string; value: string; help?: string }) {
  return (
    <div className="rounded-md bg-background/70 px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase text-muted-foreground">
        <span className="truncate">{label}</span>
        {help ? <InfoTip label={label} body={help} /> : null}
      </div>
      <div className="mt-1 font-mono text-xs font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function Sparkline({ series }: { series: Array<{ label: string; values: number[]; color: string }> }) {
  const width = 100
  const height = 34
  const max = Math.max(1, ...series.flatMap((item) => item.values))
  return (
    <div className="rounded-md border border-border/70 bg-card p-3">
      <svg className="h-[104px] w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
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

function clamp01(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return 0
  }
  return Math.min(1, Math.max(0, value))
}

function nonRepeatDiversity(repeatRate: number | undefined): number | undefined {
  if (repeatRate === undefined || !Number.isFinite(repeatRate)) {
    return undefined
  }
  return 1 - clamp01(repeatRate)
}

function formatPercent(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "-"
  }
  return `${Math.round(value * 100)}%`
}
