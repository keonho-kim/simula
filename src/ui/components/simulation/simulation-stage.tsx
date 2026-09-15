import { memo, useMemo, useState, type ReactNode } from "react"
import { Badge } from "@/ui/components/ui/badge"
import { Progress } from "@/ui/components/ui/progress"
import { useRunStore } from "@/ui/stores/run-store"
import { GraphView } from "@/ui/components/graph/graph-view"
import { buildSimulationEventNotice } from "@/ui/models/simulation/simulation-event-notice"
import { SimulationEventNoticeCard } from "@/ui/components/simulation/simulation-event-notice-card"
import { buildSimulationStageStatus } from "@/ui/models/simulation/simulation-stage-status"
import type { UiTexts } from "@/ui/types/i18n"
import { cn } from "@/ui/lib/class-names"

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

export const SimulationStage = memo(function SimulationStage({
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
  const liveEvents = useRunStore((state) => state.stageEvents)
  const runState = useRunStore((state) => state.runState)
  const frame = timeline[replayIndex] ?? timeline.at(-1)
  const status = useMemo(() => buildSimulationStageStatus(liveEvents, runState, timeline), [liveEvents, runState, timeline])
  const completedNodes = liveEvents.filter((event) => event.type === "node.completed").length
  const progress = Math.min(100, completedNodes * 25)
  const eventNotice = useMemo(() => buildSimulationEventNotice(liveEvents), [liveEvents])
  const visibleEventNotice = eventNotice && !dismissedEventNoticeKeys.has(eventNotice.dismissalKey) ? eventNotice : undefined
  const dismissEventNotice = (dismissalKey: string) => {
    setDismissedEventNoticeKeys((current) => new Set(current).add(dismissalKey))
  }

  return (
    <section className={cn("flex min-h-0 min-w-0 flex-col rounded-lg bg-card/80 shadow-sm ring-1 ring-border/60", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div>
          <h2 className="font-heading text-sm font-semibold">{t.simulationStageTitle}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.simulationStageDescription}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status ? (
            <Badge variant="outline" className="rounded-md">
              {t.roundStatus} {status.currentRound}{status.maxRound ? `/${status.maxRound}` : ""}
            </Badge>
          ) : null}
          {status ? (
            <Badge variant="outline" className="rounded-md">
              {t.actorResponseStatus} {status.respondedActors}/{status.totalActors} · {t.actorWaitingStatus} {status.waitingActors}
            </Badge>
          ) : null}
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
          <div className="h-full min-h-[560px]">
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
          <SimulationEventNoticeCard notice={visibleEventNotice} t={t} onDismiss={dismissEventNotice} />
        </div>
      </div>
    </section>
  )
})
