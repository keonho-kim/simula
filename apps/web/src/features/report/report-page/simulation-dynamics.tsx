import { useState, type ReactNode } from "react"
import { ActivityIcon, CircleHelpIcon, GitBranchIcon, NetworkIcon, RepeatIcon, TargetIcon, WaypointsIcon, ZapIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { UiTexts } from "@/lib/i18n"
import { cn } from "@/lib/utils"
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
        <NetworkStructure model={model} t={t} />
        <RelationshipHeatmap model={model} t={t} />
        <RoundEvolution model={model} t={t} />
        <BehaviorRanking model={model} t={t} />
        <CoordinatorAlignment model={model} t={t} />
      </div>
    </ScrollArea>
  )
}

interface RadarMetric {
  id: string
  label: string
  value: number
  help: string
  color: string
}

export function DynamicsSignalMap({ model, t }: { model: ReportAnalysisViewModel; t: UiTexts }) {
  const summary = model.analysis.summary
  const network = model.analysis.network.summary
  const completionRate = summary.totalEventCount ? summary.completedEventCount / summary.totalEventCount : 0
  const metrics: RadarMetric[] = [
    {
      id: "density",
      label: t.directedDensity,
      value: network.directedDensity,
      help: t.directedDensityHelp,
      color: "var(--chart-1)",
    },
    {
      id: "reciprocity",
      label: t.reciprocity,
      value: network.reciprocity,
      help: t.reciprocityHelp,
      color: "var(--chart-2)",
    },
    {
      id: "action-diversity",
      label: t.actionDiversity,
      value: summary.averageActionEntropy,
      help: t.actionDiversityHelp,
      color: "var(--chart-3)",
    },
    {
      id: "visibility-diversity",
      label: t.visibilityDiversity,
      value: summary.averageVisibilityEntropy,
      help: t.visibilityDiversityHelp,
      color: "var(--chart-4)",
    },
    {
      id: "target-spread",
      label: t.targetSpread,
      value: average(model.behaviorRanking.map((actor) => actor.targetSpread)) ?? 0,
      help: t.targetSpreadHelp,
      color: "var(--chart-5)",
    },
    {
      id: "coordinator-alignment",
      label: t.coordinatorAlignment,
      value: summary.averageEventAlignment,
      help: t.coordinatorAlignmentHelp,
      color: "var(--chart-1)",
    },
    {
      id: "event-completion",
      label: t.eventCompletionRate,
      value: completionRate,
      help: t.eventCompletionRateHelp,
      color: "var(--chart-2)",
    },
  ]
  const [activeMetricId, setActiveMetricId] = useState(metrics[0]?.id ?? "")
  const activeMetric = metrics.find((metric) => metric.id === activeMetricId) ?? metrics[0]

  return (
    <section className="rounded-md border border-border/70 bg-background/80 p-3">
      <SectionTitle title={t.dynamicsSignalMap} help={t.dynamicsSignalMapDescription} icon={<TargetIcon data-icon="inline-start" />} />
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.15fr)]">
        <div className="relative mx-auto aspect-square w-full max-w-[300px] rounded-md border border-border/60 bg-card/80 p-3">
          <RadarChart metrics={metrics} activeMetricId={activeMetric?.id} label={t.dynamicsSignalMap} onSelect={setActiveMetricId} />
        </div>
        <div className="grid content-start gap-2 sm:grid-cols-2">
          {metrics.map((metric) => {
            const active = metric.id === activeMetric?.id
            return (
              <Tooltip key={metric.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "rounded-md border border-border/60 bg-muted/20 p-3 text-left transition-[background-color,border-color,transform] hover:border-ring/50 hover:bg-muted/40",
                      active && "border-ring/60 bg-accent/70 ring-2 ring-ring/20"
                    )}
                    onClick={() => setActiveMetricId(metric.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold">{metric.label}</span>
                      <span className="font-mono text-xs tabular-nums" style={{ color: metric.color }}>{formatPercent(metric.value)}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-muted">
                      <div
                        className="h-full rounded-sm transition-[width] duration-300"
                        style={{ width: `${Math.round(clamp01(metric.value) * 100)}%`, backgroundColor: metric.color }}
                      />
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px]">
                  {metric.help}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function RadarChart({
  metrics,
  activeMetricId,
  label,
  onSelect,
}: {
  metrics: RadarMetric[]
  activeMetricId: string | undefined
  label: string
  onSelect: (metricId: string) => void
}) {
  const size = 120
  const center = 60
  const radius = 46
  const outerPoints = metrics.map((_, index) => radarPoint(index, metrics.length, radius, center, 1))
  const valuePoints = metrics.map((metric, index) => radarPoint(index, metrics.length, radius, center, clamp01(metric.value)))
  return (
    <>
      <svg className="h-full w-full" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <polygon points={outerPoints.map(pointString).join(" ")} fill="none" stroke="var(--border)" strokeWidth="0.45" />
        {[0.33, 0.66].map((ratio) => (
          <polygon
            key={ratio}
            points={metrics.map((_, index) => pointString(radarPoint(index, metrics.length, radius, center, ratio))).join(" ")}
            fill="none"
            stroke="var(--border)"
            strokeWidth="0.25"
          />
        ))}
        {outerPoints.map((point, index) => (
          <path key={metrics[index]?.id} d={`M ${center} ${center} L ${pointString(point)}`} stroke="var(--border)" strokeWidth="0.25" />
        ))}
        <polygon
          points={valuePoints.map(pointString).join(" ")}
          fill="color-mix(in srgb, var(--chart-1) 13%, transparent)"
          stroke="var(--chart-1)"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        {valuePoints.map((point, index) => {
          const metric = metrics[index]
          const active = metric?.id === activeMetricId
          return (
            <circle
              key={metric?.id}
              cx={point.x}
              cy={point.y}
              r={active ? 2.5 : 1.8}
              fill={metric?.color}
              className={active ? "animate-pulse" : undefined}
            />
          )
        })}
      </svg>
      {metrics.map((metric, index) => {
        const point = radarPoint(index, metrics.length, radius, center, clamp01(metric.value))
        const active = metric.id === activeMetricId
        return (
          <Tooltip key={metric.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${metric.label}: ${formatPercent(metric.value)}`}
                className={cn(
                  "absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background/80 transition-[box-shadow,transform] hover:scale-110",
                  active && "scale-110 ring-2 ring-ring/50"
                )}
                style={{
                  left: `${(point.x / size) * 100}%`,
                  top: `${(point.y / size) * 100}%`,
                  backgroundColor: metric.color,
                }}
                onClick={() => onSelect(metric.id)}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px]">
              <div className="grid gap-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{metric.label}</span>
                  <span className="font-mono">{formatPercent(metric.value)}</span>
                </div>
                <span>{metric.help}</span>
              </div>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </>
  )
}

export function DynamicsKpis({
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
      value: formatPercent(nonRepeatDiversity(model.analysis.summary.averageRepeatRate)),
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
    <section className="grid gap-3 md:grid-cols-3 2xl:grid-cols-9" aria-label={t.simulationDynamicsKpis}>
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
          <MiniMetric label={t.validActions} value={summary.validActionCount.toLocaleString()} help={t.validActionsHelp} />
          <MiniMetric label={t.activeDyads} value={model.analysis.network.relationshipMetrics.length.toLocaleString()} help={t.activeDyadsHelp} />
          <MiniMetric label={t.components} value={summary.connectedComponentCount.toLocaleString()} help={t.componentsHelp} />
          <MiniMetric label={t.isolates} value={summary.isolateCount.toLocaleString()} help={t.isolatesHelp} />
          <MiniMetric label={t.centralization} value={formatPercent(summary.degreeCentralization)} help={t.centralizationHelp} />
          <MiniMetric label={t.tieInequality} value={formatDecimal(summary.tieStrengthGini)} help={t.tieInequalityHelp} />
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
            { label: t.actions, values: rounds.map((round) => round.actionCount), color: "var(--chart-1)" },
            { label: t.activeActors, values: rounds.map((round) => round.activeActorCount), color: "var(--chart-2)" },
            { label: t.newTies, values: rounds.map((round) => round.newTies), color: "var(--chart-3)" },
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
                  {formatPercent(nonRepeatDiversity(actor.consecutiveRepeatRate))} {t.repeatRate}
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

function radarPoint(index: number, total: number, radius: number, center: number, ratio: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index / total) * Math.PI * 2
  const distance = radius * ratio
  return {
    x: center + Math.cos(angle) * distance,
    y: center + Math.sin(angle) * distance,
  }
}

function pointString(point: { x: number; y: number }): string {
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`
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
