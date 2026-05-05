import { useState, type ReactNode } from "react"
import type { RunEvent } from "@simula/shared"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useRunStore } from "@/store/run-store"
import { GraphView } from "@/widgets/graph-view"
import { buildSimulationEventNotice } from "@/widgets/simulation-event-notice"
import { SimulationEventNoticeCard } from "@/widgets/simulation-event-notice-card"
import { buildSimulationInterlude, type InterludeStageStatus, type SimulationInterludeState } from "@/widgets/simulation-stage-interlude"
import type { UiTexts } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { MarkdownContent } from "@/shared/ui/markdown-content"

const noopActorSelect = () => undefined
const noopEdgeSelect = () => undefined

interface SimulationStageProps {
  t: UiTexts
  className?: string
  graphClassName?: string
  actions?: ReactNode
  selectedActorId?: string
  onActorSelect?: (actorId: string | undefined) => void
  onActorExpand?: (actorId: string) => void
  selectedEdgeId?: string
  onEdgeSelect?: (edgeId: string | undefined) => void
  showActorPopover?: boolean
}

export function SimulationStage({
  t,
  className,
  graphClassName,
  actions,
  selectedActorId,
  onActorSelect,
  onActorExpand,
  selectedEdgeId,
  onEdgeSelect,
  showActorPopover = false,
}: SimulationStageProps) {
  const [dismissedEventNoticeKeys, setDismissedEventNoticeKeys] = useState<Set<string>>(() => new Set())
  const timeline = useRunStore((state) => state.timeline)
  const replayIndex = useRunStore((state) => state.replayIndex)
  const liveEvents = useRunStore((state) => state.liveEvents)
  const runState = useRunStore((state) => state.runState)
  const frame = timeline[replayIndex] ?? timeline.at(-1)
  const completedNodes = liveEvents.filter((event) => event.type === "node.completed").length
  const progress = Math.min(100, completedNodes * 25)
  const interlude = buildSimulationInterlude(liveEvents, t)
  const eventNotice = buildSimulationEventNotice(liveEvents)
  const visibleEventNotice = eventNotice && !dismissedEventNoticeKeys.has(eventNotice.dismissalKey) ? eventNotice : undefined
  const terminal = hasTerminalEvent(liveEvents)
  const dismissEventNotice = (dismissalKey: string) => {
    setDismissedEventNoticeKeys((current) => new Set(current).add(dismissalKey))
  }

  return (
    <section className={cn("flex min-h-0 flex-col rounded-lg bg-card/80 shadow-sm ring-1 ring-border/60", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div>
          <h2 className="font-heading text-sm font-semibold">{t.simulationStageTitle}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.simulationStageDescription}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-md">
            {t.simulationFrame} {timeline.length ? replayIndex + 1 : 0}/{timeline.length}
          </Badge>
          <Badge variant="secondary" className="rounded-md">
            {frame?.timestamp ?? t.simulationIdle}
          </Badge>
          {actions}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <Progress value={progress} className="h-1.5" />
        <div className={cn("relative min-h-[560px] flex-1", graphClassName)}>
          <div className={cn("h-full min-h-[560px] transition duration-300", interlude && "grayscale opacity-55")}>
            <GraphView
              frame={frame}
              t={t}
              selectedActorId={selectedActorId}
              onActorSelect={onActorSelect ?? noopActorSelect}
              onActorExpand={onActorExpand}
              selectedEdgeId={selectedEdgeId}
              onEdgeSelect={onEdgeSelect ?? noopEdgeSelect}
              showActorPopover={showActorPopover}
              actors={runState?.actors}
            />
          </div>
          <SimulationInterludeOverlay
            interlude={interlude}
            terminal={terminal}
            t={t}
          />
          <SimulationEventNoticeCard notice={visibleEventNotice} t={t} onDismiss={dismissEventNotice} />
        </div>
      </div>
    </section>
  )
}

function SimulationInterludeOverlay({
  interlude,
  terminal,
  t,
}: {
  interlude?: SimulationInterludeState
  terminal: boolean
  t: UiTexts
}) {
  const details = interlude?.details.filter((item) => item.stageId === interlude.activeStageId).slice(0, 4) ?? []
  const activeRound = terminal ? undefined : details.find((message) => message.roundIndex)?.roundIndex
  if (!interlude || terminal) {
    return null
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-muted/70 p-3 backdrop-grayscale sm:p-4">
      <div className="flex h-[86%] max-h-[86%] min-h-[420px] w-[calc(100%-24px)] flex-col overflow-hidden rounded-lg border border-border/80 bg-card text-left shadow-sm md:w-[86%] lg:w-[82%]">
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <aside className="shrink-0 border-b border-border/70 bg-background/80 p-4 md:w-56 md:border-b-0 md:border-r">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{t.interlude}</p>
            <div className="mt-4 space-y-1.5">
              {interlude.stages.map((stage) => (
                <div
                  key={stage.id}
                  className={cn(
                    "flex h-10 items-center justify-between gap-2 rounded-md px-2.5 text-sm transition-colors",
                    stage.status === "active" && "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-100",
                    stage.status === "done" && "text-muted-foreground",
                    stage.status === "waiting" && "text-muted-foreground/70"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-full", stageDotClass(stage.status))} />
                    <span className="truncate font-medium">{stage.label}</span>
                  </span>
                  {stage.status === "done" ? (
                    <span className="shrink-0 font-mono text-[10px] font-semibold text-muted-foreground">
                      {t.interludeStageDone}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </aside>

          <div className="flex min-h-0 flex-1 flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{t.currentStep}</p>
                <h3 className="mt-1 truncate text-base font-semibold text-foreground">{interlude.title}</h3>
              </div>
              {activeRound !== undefined ? (
                <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  R{activeRound}
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InterludeMetric label={interlude.roleLabel} value={interlude.stepLabel} />
              <InterludeMetric label={t.actorCards} value={interlude.actorCardProgress ?? "0"} />
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-md border border-border/70 bg-background/80 p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="space-y-3">
                {details.length ? details.map((item) => (
                  <article key={item.id} className="rounded-md border border-border/60 bg-card/80 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block truncate text-xs font-semibold uppercase text-muted-foreground">
                          {item.stepLabel}
                        </span>
                        <h4 className="mt-1 truncate text-sm font-semibold text-foreground">{item.title}</h4>
                      </div>
                      {item.roundIndex !== undefined ? (
                        <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                          R{item.roundIndex}
                        </span>
                      ) : null}
                    </div>
                    <MarkdownContent compact className="mt-2 text-sm leading-6 text-foreground" content={item.message} fallback="" />
                  </article>
                )) : (
                  <article className="rounded-md border border-border/60 bg-card/80 p-3">
                    <span className="block truncate text-xs font-semibold uppercase text-muted-foreground">
                      {interlude.stepLabel}
                    </span>
                    <h4 className="mt-1 truncate text-sm font-semibold text-foreground">{interlude.roleLabel}</h4>
                    <MarkdownContent compact className="mt-2 text-sm leading-6 text-foreground" content={interlude.message} fallback="" />
                  </article>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InterludeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border/60 bg-background/80 px-3 py-2">
      <p className="truncate text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function hasTerminalEvent(events: RunEvent[]): boolean {
  const runStartedIndex = lastIndexOf(events, (event) => event.type === "run.started")
  const scopedEvents = runStartedIndex < 0 ? events : events.slice(runStartedIndex)
  return scopedEvents.some((event) => event.type === "run.completed" || event.type === "run.failed" || event.type === "run.canceled")
}

function stageDotClass(status: InterludeStageStatus): string {
  if (status === "active") return "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.16)]"
  if (status === "done") return "bg-muted-foreground/40"
  return "bg-border"
}

function lastIndexOf<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index] as T)) {
      return index
    }
  }
  return -1
}
