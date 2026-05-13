import type { ReactNode } from "react"
import { ActivityIcon, CircleHelpIcon, GitBranchIcon, NetworkIcon, RepeatIcon, TargetIcon, WaypointsIcon, ZapIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { UiTexts } from "@/lib/i18n"
import type { ReportAnalysisViewModel } from "../report-analysis-view-model"
import { EmptyPanel } from "./ui"

export function ReportSimulationDynamics({
  model,
  t,
}: {
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

  return (
    <ScrollArea className="h-[calc(100svh-214px)] min-h-[560px] p-3">
      <div className="flex flex-col gap-3 pr-3">
        <DynamicsKpis model={model} t={t} />
        <NetworkStructure model={model} t={t} />
        <RelationshipHeatmap model={model} t={t} />
        <RoundEvolution model={model} t={t} />
        <BehaviorRanking model={model} t={t} />
        <CoordinatorAlignment model={model} t={t} />
      </div>
    </ScrollArea>
  )
}

function DynamicsKpis({
  model,
  t,
}: {
  model: ReportAnalysisViewModel
  t: UiTexts
}) {
  const completionRate = model.analysis.summary.totalEventCount
    ? model.analysis.summary.completedEventCount / model.analysis.summary.totalEventCount
    : 0
  const cards = [
    {
      icon: NetworkIcon,
      label: t.directedDensity,
      value: formatPercent(model.analysis.network.summary.directedDensity),
      help: t.directedDensityHelp,
    },
    {
      icon: WaypointsIcon,
      label: t.reciprocity,
      value: formatPercent(model.analysis.network.summary.reciprocity),
      help: t.reciprocityHelp,
    },
    {
      icon: NetworkIcon,
      label: t.clustering,
      value: formatPercent(model.analysis.network.summary.clusteringCoefficient),
      help: t.clusteringHelp,
    },
    {
      icon: ActivityIcon,
      label: t.actionDiversity,
      value: formatPercent(model.analysis.summary.averageActionEntropy),
      help: t.actionDiversityHelp,
    },
    {
      icon: ZapIcon,
      label: t.visibilityDiversity,
      value: formatPercent(model.analysis.summary.averageVisibilityEntropy),
      help: t.visibilityDiversityHelp,
    },
    {
      icon: TargetIcon,
      label: t.averageTargetSpread,
      value: formatPercent(average(model.behaviorRanking.map((actor) => actor.targetSpread))),
      help: t.targetSpreadHelp,
    },
    {
      icon: RepeatIcon,
      label: t.repeatRate,
      value: formatPercent(model.analysis.summary.averageRepeatRate),
      help: t.repeatRateHelp,
    },
    {
      icon: GitBranchIcon,
      label: t.coordinatorAlignment,
      value: formatPercent(model.analysis.summary.averageEventAlignment),
      help: t.coordinatorAlignmentHelp,
    },
    {
      icon: GitBranchIcon,
      label: t.eventCompletionRate,
      value: formatPercent(completionRate),
      help: t.eventCompletionRateHelp,
    },
  ]

  return (
    <section className="grid gap-3 md:grid-cols-3 2xl:grid-cols-8" aria-label={t.simulationDynamicsKpis}>
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <article key={card.label} className="rounded-md border border-border/70 bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase text-muted-foreground">
                <Icon data-icon="inline-start" />
                <span className="truncate">{card.label}</span>
              </div>
              <InfoTip label={card.label} body={card.help} />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">{card.value}</div>
          </article>
        )
      })}
    </section>
  )
}

function NetworkStructure({ model, t }: { model: ReportAnalysisViewModel; t: UiTexts }) {
  const summary = model.analysis.network.summary
  return (
    <section className="rounded-md border border-border/70 bg-background/80 p-3">
      <SectionTitle title={t.relationshipStructure} help={t.relationshipStructureDescription} icon={<NetworkIcon data-icon="inline-start" />} />
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <MiniMetric label={t.validActions} value={summary.validActionCount.toLocaleString()} />
          <MiniMetric label={t.activeDyads} value={model.analysis.network.relationshipMetrics.length.toLocaleString()} />
          <MiniMetric label={t.components} value={summary.connectedComponentCount.toLocaleString()} />
          <MiniMetric label={t.isolates} value={summary.isolateCount.toLocaleString()} />
          <MiniMetric label={t.centralization} value={formatPercent(summary.degreeCentralization)} />
          <MiniMetric label={t.tieInequality} value={formatDecimal(summary.tieStrengthGini)} />
        </div>
        <div>
          <h3 className="text-xs font-semibold">{t.centralityRanking}</h3>
          <div className="mt-3 flex flex-col gap-2">
            {model.topActors.length ? (
              model.topActors.map((actor) => (
                <MetricBar
                  key={actor.actorId}
                  label={actor.actorName}
                  help={t.relationshipStructureDescription}
                  detail={`${t.counterparties}: ${actor.uniqueCounterparties}`}
                  value={actor.weightedDegree}
                  max={Math.max(1, model.topActors[0]?.weightedDegree ?? 1)}
                />
              ))
            ) : (
              <EmptyPanel title={t.noAnalysisData} body={t.noAnalysisDataDescription} compact />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function RelationshipHeatmap({ model, t }: { model: ReportAnalysisViewModel; t: UiTexts }) {
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
        <div className="mt-3 overflow-x-auto">
          <div
            className="grid min-w-[520px] overflow-hidden rounded-md border border-border/70 text-[10px]"
            style={{ gridTemplateColumns: `112px repeat(${Math.max(1, columnCount - 1)}, minmax(56px, 1fr))` }}
          >
            <div className="border-r border-b border-border/60 bg-muted/40 px-2 py-1 text-muted-foreground">{t.actor}</div>
            {model.heatmapActors.map((actor) => (
              <div key={actor.actorId} className="truncate border-b border-border/60 bg-muted/40 px-2 py-1 text-center text-muted-foreground">
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
      <div className="truncate border-r border-border/60 bg-muted/30 px-2 py-1.5 text-muted-foreground">{row.actorName}</div>
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

function RoundEvolution({ model, t }: { model: ReportAnalysisViewModel; t: UiTexts }) {
  const rounds = model.analysis.network.roundMetrics
  if (!rounds.length) {
    return <EmptyPanel title={t.noAnalysisData} body={t.noAnalysisDataDescription} compact />
  }
  return (
    <section className="rounded-md border border-border/70 bg-background/80 p-3">
      <SectionTitle title={t.roundEvolution} help={t.roundEvolutionDescription} icon={<ActivityIcon data-icon="inline-start" />} />
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Sparkline
          series={[
            { label: t.actions, values: rounds.map((round) => round.actionCount), className: "stroke-primary" },
            { label: t.activeActors, values: rounds.map((round) => round.activeActorCount), className: "stroke-muted-foreground" },
            { label: t.newTies, values: rounds.map((round) => round.newTies), className: "stroke-ring" },
          ]}
        />
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          <MiniMetric label={t.rounds} value={rounds.length.toLocaleString()} />
          <MiniMetric label={t.newTies} value={rounds.reduce((total, round) => total + round.newTies, 0).toLocaleString()} />
          <MiniMetric label={t.activeActors} value={Math.max(...rounds.map((round) => round.activeActorCount)).toLocaleString()} />
        </div>
      </div>
    </section>
  )
}

function BehaviorRanking({ model, t }: { model: ReportAnalysisViewModel; t: UiTexts }) {
  return (
    <section className="rounded-md border border-border/70 bg-background/80 p-3">
      <SectionTitle title={t.behaviorDiversity} help={t.behaviorDiversityHelp} icon={<ActivityIcon data-icon="inline-start" />} />
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
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
                  {formatPercent(actor.consecutiveRepeatRate)} {t.repeatRate}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2">
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

function CoordinatorAlignment({ model, t }: { model: ReportAnalysisViewModel; t: UiTexts }) {
  return (
    <section className="rounded-md border border-border/70 bg-background/80 p-3">
      <SectionTitle title={t.coordinatorAlignment} help={t.coordinatorAlignmentHelp} icon={<GitBranchIcon data-icon="inline-start" />} />
      <div className="mt-3 flex flex-col gap-2">
        {model.eventAlignment.length ? (
          model.eventAlignment.map((event) => (
            <article key={event.eventId} className="rounded-md bg-muted/25 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="truncate text-xs font-semibold">{event.title}</h4>
                <Badge variant={event.status === "completed" ? "secondary" : "outline"} className="rounded-sm">
                  {event.status}
                </Badge>
              </div>
              <div className="mt-3">
                <MetricBar
                  label={t.participantAlignment}
                  help={t.coordinatorAlignmentHelp}
                  detail={`${event.overlapCount}/${Math.max(event.plannedParticipantCount, event.actualParticipantCount)}`}
                  value={event.jaccardAlignment}
                  max={1}
                  percent
                />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <MiniMetric label={t.interactions} value={event.interactionCount.toLocaleString()} />
                <MiniMetric label={t.plannedActors} value={event.plannedParticipantCount.toLocaleString()} />
                <MiniMetric label={t.injectedRounds} value={event.injectedRounds.join(", ") || "-"} />
              </div>
            </article>
          ))
        ) : (
          <EmptyPanel title={t.noCoordinatorEvents} body={t.noCoordinatorEventsDescription} compact />
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
      <div className="h-2 overflow-hidden rounded-sm bg-muted">
        <div className="h-full rounded-sm bg-primary" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      {detail ? <div className="mt-1 truncate text-[10px] text-muted-foreground">{detail}</div> : null}
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/70 px-3 py-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xs font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function Sparkline({ series }: { series: Array<{ label: string; values: number[]; className: string }> }) {
  const width = 100
  const height = 34
  const max = Math.max(1, ...series.flatMap((item) => item.values))
  return (
    <div className="rounded-md border border-border/70 bg-card p-3">
      <svg className="h-[104px] w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <path d="M 0 33.5 H 100" className="stroke-border" strokeWidth="0.4" />
        {series.map((item) => (
          <path
            key={item.label}
            d={sparklinePath(item.values, max, width, height)}
            className={`fill-none ${item.className}`}
            strokeWidth="1.4"
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

function formatPercent(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "-"
  }
  return `${Math.round(value * 100)}%`
}

function formatDecimal(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

function average(values: number[]): number | undefined {
  const finite = values.filter(Number.isFinite)
  if (!finite.length) {
    return undefined
  }
  return finite.reduce((sum, value) => sum + value, 0) / finite.length
}
