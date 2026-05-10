import type { ReactNode } from "react"
import { ActivityIcon, GitBranchIcon, NetworkIcon, WaypointsIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { UiTexts } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import type { ReportAnalysisViewModel } from "../report-analysis-view-model"
import { EmptyPanel } from "./ui"

export function ReportAnalysisDashboard({
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
    <ScrollArea className="h-[calc(100svh-236px)] min-h-[560px] p-3">
      <div className="flex flex-col gap-3 pr-3">
        <KpiStrip model={model} t={t} />

        <div className="grid gap-3 2xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.72fr)_minmax(360px,0.78fr)]">
          <section className="flex flex-col gap-3">
            <PanelHeader
              icon={<NetworkIcon data-icon="inline-start" />}
              title={t.relationshipStructure}
              description={t.relationshipStructureDescription}
            />
            <NetworkStructure model={model} t={t} />
          </section>

          <section className="flex flex-col gap-3">
            <RelationshipHeatmap model={model} t={t} />
            <div className="flex flex-col gap-3 rounded-md border border-border/70 bg-background/80 p-3">
              <PanelHeader
                icon={<ActivityIcon data-icon="inline-start" />}
                title={t.roundEvolution}
                description={t.roundEvolutionDescription}
              />
              <RoundEvolution model={model} t={t} />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <PanelHeader
              icon={<WaypointsIcon data-icon="inline-start" />}
              title={t.behaviorDiversity}
              description={t.behaviorDiversityDescription}
            />
            <BehaviorRanking model={model} t={t} />
            <CoordinatorAlignment model={model} t={t} />
          </section>
        </div>
      </div>
    </ScrollArea>
  )
}

function KpiStrip({ model, t }: { model: ReportAnalysisViewModel; t: UiTexts }) {
  const summary = model.analysis.network.summary
  const cards = [
    { label: t.directedDensity, value: formatPercent(summary.directedDensity), tone: "default" },
    { label: t.reciprocity, value: formatPercent(summary.reciprocity), tone: "default" },
    { label: t.clustering, value: formatPercent(summary.clusteringCoefficient), tone: "default" },
    { label: t.actionDiversity, value: formatPercent(model.analysis.summary.averageActionEntropy), tone: "accent" },
    { label: t.eventAlignment, value: formatPercent(model.analysis.summary.averageEventAlignment), tone: "accent" },
    { label: t.repeatRate, value: formatPercent(model.analysis.summary.averageRepeatRate), tone: "muted" },
  ] as const

  return (
    <section className="grid gap-3 md:grid-cols-3 2xl:grid-cols-6" aria-label={t.analysisKpis}>
      {cards.map((card) => (
        <article key={card.label} className="rounded-md border border-border/70 bg-background p-3">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">{card.label}</div>
          <div className={cn("mt-2 font-mono text-2xl font-semibold tabular-nums", card.tone === "muted" && "text-muted-foreground")}>
            {card.value}
          </div>
        </article>
      ))}
    </section>
  )
}

function NetworkStructure({ model, t }: { model: ReportAnalysisViewModel; t: UiTexts }) {
  const summary = model.analysis.network.summary
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] 2xl:grid-cols-1">
      <section className="rounded-md border border-border/70 bg-background/80 p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <MiniMetric label={t.validActions} value={summary.validActionCount.toLocaleString()} />
          <MiniMetric label={t.activeDyads} value={model.analysis.network.relationshipMetrics.length.toLocaleString()} />
          <MiniMetric label={t.components} value={summary.connectedComponentCount.toLocaleString()} />
          <MiniMetric label={t.isolates} value={summary.isolateCount.toLocaleString()} />
          <MiniMetric label={t.centralization} value={formatPercent(summary.degreeCentralization)} />
          <MiniMetric label={t.tieInequality} value={formatDecimal(summary.tieStrengthGini)} />
        </div>
      </section>
      <section className="rounded-md border border-border/70 bg-background/80 p-3">
        <h3 className="text-xs font-semibold">{t.centralityRanking}</h3>
        <div className="mt-3 flex flex-col gap-2">
          {model.topActors.length ? (
            model.topActors.map((actor) => (
              <MetricBar
                key={actor.actorId}
                label={actor.actorName}
                detail={`${t.counterparties}: ${actor.uniqueCounterparties}`}
                value={actor.weightedDegree}
                max={Math.max(1, model.topActors[0]?.weightedDegree ?? 1)}
              />
            ))
          ) : (
            <EmptyPanel title={t.noAnalysisData} body={t.noAnalysisDataDescription} compact />
          )}
        </div>
      </section>
    </div>
  )
}

function RelationshipHeatmap({ model, t }: { model: ReportAnalysisViewModel; t: UiTexts }) {
  const columnCount = model.heatmapActors.length + 1
  return (
    <section className="rounded-md border border-border/70 bg-background/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold">{t.relationshipHeatmap}</h3>
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

function BehaviorRanking({ model, t }: { model: ReportAnalysisViewModel; t: UiTexts }) {
  return (
    <section className="rounded-md border border-border/70 bg-background/80 p-3">
      <h3 className="text-xs font-semibold">{t.actorBehaviorRanking}</h3>
      <div className="mt-3 flex flex-col gap-3">
        {model.behaviorRanking.length ? (
          model.behaviorRanking.slice(0, 4).map((actor) => (
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
                <MetricBar label={t.actionDiversity} value={actor.normalizedActionTypeEntropy} max={1} percent />
                <MetricBar label={t.visibilityDiversity} value={actor.normalizedVisibilityEntropy} max={1} percent />
                <MetricBar label={t.targetSpread} value={actor.targetSpread} max={1} percent />
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
      <div className="flex items-center gap-2">
        <GitBranchIcon data-icon="inline-start" />
        <h3 className="text-xs font-semibold">{t.coordinatorAlignment}</h3>
      </div>
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

function RoundEvolution({ model, t }: { model: ReportAnalysisViewModel; t: UiTexts }) {
  const rounds = model.analysis.network.roundMetrics
  if (!rounds.length) {
    return <EmptyPanel title={t.noAnalysisData} body={t.noAnalysisDataDescription} compact />
  }
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
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
            className={cn("fill-none", item.className)}
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

function MetricBar({
  label,
  detail,
  value,
  max,
  percent = false,
}: {
  label: string
  detail?: string
  value: number
  max: number
  percent?: boolean
}) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
        <span className="truncate font-medium text-muted-foreground">{label}</span>
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
    <div className="rounded-md bg-muted/30 px-3 py-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xs font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function PanelHeader({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <h2 className="font-heading text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
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

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function formatDecimal(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
}
