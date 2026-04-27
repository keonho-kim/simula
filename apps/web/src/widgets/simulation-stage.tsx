import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useRunStore } from "@/store/run-store"
import { GraphView } from "@/widgets/graph-view"

export function SimulationStage() {
  const timeline = useRunStore((state) => state.timeline)
  const replayIndex = useRunStore((state) => state.replayIndex)
  const liveEvents = useRunStore((state) => state.liveEvents)
  const frame = timeline[replayIndex] ?? timeline.at(-1)
  const completedNodes = liveEvents.filter((event) => event.type === "node.completed").length
  const progress = Math.min(100, completedNodes * 25)

  return (
    <section className="flex min-h-0 flex-col rounded-lg bg-card/80 shadow-sm ring-1 ring-border/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div>
          <h2 className="font-heading text-sm font-semibold">Simulation Stage</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Workflow, actors, events, and artifacts as a single live graph.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-md">
            Frame {timeline.length ? replayIndex + 1 : 0}/{timeline.length}
          </Badge>
          <Badge variant="secondary" className="rounded-md">
            {frame?.timestamp ?? "Idle"}
          </Badge>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <Progress value={progress} className="h-1.5" />
        <div className="min-h-[560px] flex-1">
          <GraphView frame={frame} />
        </div>
      </div>
    </section>
  )
}
