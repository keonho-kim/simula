import type { ReactNode } from "react"
import type { ModelRole, RunEvent } from "@simula/shared"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useRunStore } from "@/store/run-store"
import { GraphView } from "@/widgets/graph-view"
import { buildSimulationInterlude, type SimulationInterludeState } from "@/widgets/simulation-stage-interlude"
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

interface InterludeMessage {
  id: string
  title: string
  stepLabel: string
  message: string
  roundIndex?: number
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
  const timeline = useRunStore((state) => state.timeline)
  const replayIndex = useRunStore((state) => state.replayIndex)
  const liveEvents = useRunStore((state) => state.liveEvents)
  const frame = timeline[replayIndex] ?? timeline.at(-1)
  const completedNodes = liveEvents.filter((event) => event.type === "node.completed").length
  const progress = Math.min(100, completedNodes * 25)
  const interlude = buildSimulationInterlude(liveEvents, t)
  const terminal = hasTerminalEvent(liveEvents)

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
            />
          </div>
          <SimulationInterludeOverlay
            events={liveEvents}
            interlude={interlude}
            terminal={terminal}
            t={t}
          />
        </div>
      </div>
    </section>
  )
}

function SimulationInterludeOverlay({
  events,
  interlude,
  terminal,
  t,
}: {
  events: RunEvent[]
  interlude?: SimulationInterludeState
  terminal: boolean
  t: UiTexts
}) {
  const messages = buildInterludeMessages(events, interlude, t)
  const activeRound = terminal ? undefined : messages.find((message) => message.roundIndex)?.roundIndex
  if (!interlude || terminal || !messages.length) {
    return null
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-muted/70 p-3 backdrop-grayscale sm:p-4">
      <div className="flex max-h-[86%] w-[calc(100%-24px)] flex-col rounded-lg border border-border/80 bg-card p-5 text-left shadow-sm md:w-[86%] lg:w-[82%]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{t.interlude}</p>
            <h3 className="mt-1 text-base font-semibold text-foreground">{interlude.title}</h3>
          </div>
          {activeRound !== undefined ? (
            <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              R{activeRound}
            </span>
          ) : null}
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-md border border-border/70 bg-background/80 p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="space-y-3">
            {messages.map((item) => (
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
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

function buildInterludeMessages(events: RunEvent[], interlude: SimulationInterludeState | undefined, t: UiTexts): InterludeMessage[] {
  const runStartedIndex = lastIndexOf(events, (event) => event.type === "run.started")
  if (runStartedIndex < 0 || !interlude) {
    return []
  }

  const scopedEvents = events.slice(runStartedIndex)
  const latestActorActionIndex = lastIndexOf(scopedEvents, isActorActionMessage)
  const latestRoundCompletedIndex = lastIndexOf(scopedEvents, (event) => event.type === "round.completed")
  const startIndex = latestRoundCompletedIndex > latestActorActionIndex ? latestRoundCompletedIndex : 0
  const roundCompleted = scopedEvents[startIndex]
  const messages: InterludeMessage[] = []

  if (roundCompleted?.type === "round.completed") {
    messages.push({
      id: `round-${roundCompleted.roundIndex}`,
      title: `${t.roundReadyTitle} ${roundCompleted.roundIndex}`,
      stepLabel: t.roundReadyStep,
      message: t.roundReadyMessage,
      roundIndex: roundCompleted.roundIndex,
    })
  }

  for (let index = startIndex; index < scopedEvents.length; index += 1) {
    const event = scopedEvents[index]
    const message = interludeMessageFromEvent(event, index, t)
    if (message) {
      messages.push(message)
    }
  }

  if (!messages.length) {
    return [{
      id: "interlude-current",
      title: interlude.title,
      stepLabel: interlude.stepLabel,
      message: interlude.message,
    }]
  }
  return [...messages].reverse()
}

function interludeMessageFromEvent(event: RunEvent, index: number, t: UiTexts): InterludeMessage | undefined {
  if (event.type === "model.message") {
    const parsed = parseModelMessageStep(event.content)
    return {
      id: `model-${index}`,
      title: roleLabel(event.role),
      stepLabel: parsed.step ? traceStepLabel(parsed.step) : t.interludeThinking,
      message: parsed.content || event.content,
    }
  }
  if (event.type === "node.started") {
    return {
      id: `node-started-${index}`,
      title: event.label,
      stepLabel: t.interludeStarting,
      message: `${event.label} ${t.interludeReadingState}`,
    }
  }
  if (event.type === "node.completed") {
    return {
      id: `node-completed-${index}`,
      title: event.label,
      stepLabel: t.interludeCompleted,
      message: `${event.label} ${t.interludeFinishedPass}`,
    }
  }
  return undefined
}

function hasTerminalEvent(events: RunEvent[]): boolean {
  const runStartedIndex = lastIndexOf(events, (event) => event.type === "run.started")
  const scopedEvents = runStartedIndex < 0 ? events : events.slice(runStartedIndex)
  return scopedEvents.some((event) => event.type === "run.completed" || event.type === "run.failed" || event.type === "run.canceled")
}

function isActorActionMessage(event: RunEvent): boolean {
  if (event.type !== "model.message" || event.role !== "actor") {
    return false
  }
  return parseModelMessageStep(event.content).step.toLowerCase() === "action"
}

function parseModelMessageStep(content: string): { step: string; content: string } {
  const normalized = stripRolePrefix(content)
  const match = normalized.match(/^\s*(.+?)\s*[:：]\s*([\s\S]+)$/)
  const rawLabel = match?.[1]?.trim() ?? ""
  const message = stripRolePrefix(match?.[2]?.trim() ?? normalized.trim())
  const step = rawLabel.split(/\s+/).at(-1) ?? ""
  return { step, content: message }
}

function stripRolePrefix(content: string): string {
  return content
    .replace(/^\s*(?:Planner|Generator|Coordinator|Observer|Actor|Repair)\s*[:：]\s*/i, "")
    .trim()
}

function roleLabel(role: ModelRole): string {
  if (role === "planner") return "Planner"
  if (role === "generator") return "Generator"
  if (role === "coordinator") return "Coordinator"
  if (role === "observer") return "Observer"
  if (role === "actor") return "Actor"
  return "Repair"
}

function traceStepLabel(step: string): string {
  return step
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function lastIndexOf<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index] as T)) {
      return index
    }
  }
  return -1
}
