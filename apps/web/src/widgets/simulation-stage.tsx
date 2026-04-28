import type React from "react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useRunStore } from "@/store/run-store"
import { GraphView } from "@/widgets/graph-view"
import { buildSimulationInterlude, type SimulationInterludeState } from "@/widgets/simulation-stage-interlude"
import type { UiTexts } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const noopActorSelect = () => undefined

interface SimulationStageProps {
  t: UiTexts
  className?: string
  graphClassName?: string
  actions?: React.ReactNode
  selectedActorId?: string
  onActorSelect?: (actorId: string | undefined) => void
  showActorPopover?: boolean
}

export function SimulationStage({ t, className, graphClassName, actions, selectedActorId, onActorSelect, showActorPopover = false }: SimulationStageProps) {
  const timeline = useRunStore((state) => state.timeline)
  const replayIndex = useRunStore((state) => state.replayIndex)
  const liveEvents = useRunStore((state) => state.liveEvents)
  const frame = timeline[replayIndex] ?? timeline.at(-1)
  const completedNodes = liveEvents.filter((event) => event.type === "node.completed").length
  const progress = Math.min(100, completedNodes * 25)
  const interlude = buildSimulationInterlude(liveEvents, t)

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
              showActorPopover={showActorPopover}
            />
          </div>
          {interlude ? <SimulationInterludeOverlay interlude={interlude} t={t} /> : null}
        </div>
      </div>
    </section>
  )
}

function SimulationInterludeOverlay({ interlude, t }: { interlude: SimulationInterludeState; t: UiTexts }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-muted/70 p-4 backdrop-grayscale">
      <div className="flex max-h-[75%] w-[calc(100%-32px)] flex-col rounded-lg border border-border/80 bg-card p-5 text-left shadow-sm md:w-[75%]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{t.interlude}</p>
            <h3 className="mt-1 text-base font-semibold text-foreground">{interlude.title}</h3>
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-md border border-border/70 bg-background/80 p-3">
          <span className="block truncate text-xs font-semibold text-muted-foreground">{interlude.stepLabel}</span>
          <p className="mt-2 text-sm leading-6 text-foreground">{interlude.message}</p>
        </div>

        {interlude.actorCardProgress ? (
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{t.actorCards}</span>
            <span className="font-mono text-foreground">{interlude.actorCardProgress}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
