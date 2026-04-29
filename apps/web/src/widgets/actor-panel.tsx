import { useMemo, useState } from "react"
import { ArrowDownLeftIcon, ArrowUpRightIcon, BrainIcon, MessageSquareIcon } from "lucide-react"
import type { ActorState, GraphNodeView, Interaction, RunEvent } from "@simula/shared"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { UiTexts } from "@/lib/i18n"
import { MarkdownContent } from "@/shared/ui/markdown-content"
import { useRunStore } from "@/store/run-store"

type HistoryFilter = "all" | "outgoing" | "incoming" | "message"

interface ActorSummary {
  id: string
  name: string
  role: string
  intent: string
  backgroundHistory: string
  personality: string
  preference: string
  privateGoal: string
  contextSummary: string
  interactionCount: number
  latestActivity: string
  messageCount: number
}

interface ActorHistoryItem {
  id: string
  type: "outgoing" | "incoming" | "message"
  roundIndex?: number
  timestamp?: string
  title: string
  counterpart?: string
  content: string
  visibility?: Interaction["visibility"]
  actionType?: string
}

export function ActorCardRail({
  t,
  selectedActorId,
  onActorSelect,
}: {
  t: UiTexts
  selectedActorId?: string
  onActorSelect: (actorId: string) => void
}) {
  const { actors } = useActorPanelData(t)

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg bg-card/80 shadow-sm ring-1 ring-border/60">
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="font-heading text-sm font-semibold">{t.actors}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t.actorsDescription}</p>
      </div>
      <ScrollArea className="min-h-0 flex-1 p-3">
        <div className="grid gap-2 pr-3">
          {actors.length ? actors.map((actor) => (
            <button
              key={actor.id}
              type="button"
              className={`rounded-md p-3 text-left transition-colors ring-1 ${
                actor.id === selectedActorId
                  ? "bg-background text-foreground ring-foreground/20"
                  : "bg-background/70 text-foreground ring-border/60 hover:bg-background"
              }`}
              onClick={() => onActorSelect(actor.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{actor.name}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{actor.role}</p>
                </div>
                <Badge variant="secondary" className="h-5 rounded-sm px-1.5 text-[10px]">
                  {actor.interactionCount}
                </Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {actor.latestActivity || actor.intent || t.waitingForActivity}
              </p>
            </button>
          )) : (
            <div className="rounded-md border border-dashed border-border/80 bg-muted/30 p-4 text-sm">
              <p className="font-medium">{t.noActorsYet}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{t.noActorsYetDescription}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}

export function ActorDetailDialog({
  t,
  actorId,
  open,
  onOpenChange,
}: {
  t: UiTexts
  actorId?: string
  open?: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [filter, setFilter] = useState<HistoryFilter>("all")
  const { actors, history } = useActorPanelData(t)
  const actor = actors.find((item) => item.id === actorId)
  const actorHistory = useMemo(
    () => actorId ? filterHistory(history.filter((item) => item.id.startsWith(`${actorId}:`)), filter) : [],
    [actorId, filter, history]
  )
  const stats = useMemo(() => buildHistoryStats(history.filter((item) => actorId && item.id.startsWith(`${actorId}:`))), [actorId, history])
  const dialogOpen = Boolean(actor) && (open ?? true)

  return (
    <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88svh] flex-col overflow-hidden sm:max-w-[1120px]">
        {actor ? (
          <>
            <DialogHeader className="shrink-0">
              <DialogTitle>{actor.name}</DialogTitle>
              <DialogDescription>{actor.role}</DialogDescription>
            </DialogHeader>

            <ScrollArea className="min-h-0 flex-1 pr-3">
              <div className="grid gap-4 pr-3 lg:grid-cols-[280px_minmax(0,1fr)]">
                <section className="rounded-md bg-muted/20 p-4">
                  <div className="flex items-center gap-2">
                    <BrainIcon className="size-4 text-muted-foreground" />
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground">{t.actorCard}</h3>
                  </div>
                  <ActorField label={t.actorBackground} value={actor.backgroundHistory} />
                  <ActorField label={t.actorPersonality} value={actor.personality} />
                  <ActorField label={t.actorPreference} value={actor.preference} />
                  <ActorField label={t.actorPrivateGoal} value={actor.privateGoal} />
                  <ActorField label={t.actorContextSummary} value={actor.contextSummary || t.actorNoCompressedContext} />
                </section>

                <section className="flex min-h-0 flex-col overflow-hidden rounded-md bg-muted/20">
                  <div className="grid gap-3 border-b border-border/70 p-3 md:grid-cols-2">
                    <ActorSummaryField label={t.actorCurrentIntent} value={actor.intent || t.graphNoIntent} />
                    <ActorSummaryField label={t.actorLatestActivity} value={actor.latestActivity || t.waitingForActivity} />
                  </div>
                  <div className="grid grid-cols-4 gap-2 p-3">
                    <ActorStat label={t.actorTotal} value={stats.total} />
                    <ActorStat label={t.actorOut} value={stats.outgoing} />
                    <ActorStat label={t.actorIn} value={stats.incoming} />
                    <ActorStat label={t.actorMsg} value={stats.messages} />
                  </div>
                  <div className="border-y border-border/70 px-3 py-2">
                    <Tabs value={filter} onValueChange={(value) => setFilter(value as HistoryFilter)}>
                      <TabsList className="grid h-auto w-full grid-cols-4 bg-background/70">
                        <TabsTrigger value="all" className="text-xs">{t.actorAll}</TabsTrigger>
                        <TabsTrigger value="outgoing" className="text-xs">{t.actorOutgoingShort}</TabsTrigger>
                        <TabsTrigger value="incoming" className="text-xs">{t.actorIncomingShort}</TabsTrigger>
                        <TabsTrigger value="message" className="text-xs">{t.actorMessageShort}</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <div className="min-h-0 flex-1 p-3">
                    {actorHistory.length ? (
                      <div className="space-y-2">
                        {actorHistory.map((item) => <ActorHistoryCard key={item.id} item={item} />)}
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed border-border/80 bg-background/60 p-4 text-sm">
                        <p className="font-medium">{t.noHistoryYet}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {t.noHistoryYetDescription}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </ScrollArea>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function useActorPanelData(t: UiTexts): { actors: ActorSummary[]; history: ActorHistoryItem[] } {
  const timeline = useRunStore((state) => state.timeline)
  const replayIndex = useRunStore((state) => state.replayIndex)
  const liveEvents = useRunStore((state) => state.liveEvents)
  const runState = useRunStore((state) => state.runState)
  const frame = timeline[replayIndex] ?? timeline.at(-1)
  const actorNames = useMemo(() => buildActorNameMap(frame?.nodes ?? [], liveEvents, runState?.actors ?? []), [frame, liveEvents, runState?.actors])
  const history = useMemo(
    () => buildActorHistory(liveEvents, runState?.interactions ?? [], actorNames, t),
    [actorNames, liveEvents, runState?.interactions, t]
  )
  const actors = useMemo(
    () => buildActorSummaries(runState?.actors ?? [], frame?.nodes ?? [], liveEvents, history),
    [frame?.nodes, history, liveEvents, runState?.actors]
  )
  return { actors, history }
}

function buildActorSummaries(
  stateActors: ActorState[],
  nodes: GraphNodeView[],
  liveEvents: RunEvent[],
  history: ActorHistoryItem[]
): ActorSummary[] {
  const summaries = new Map<string, ActorSummary>()
  for (const actor of stateActors) {
    summaries.set(actor.id, {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      intent: actor.intent,
      backgroundHistory: actor.backgroundHistory,
      personality: actor.personality,
      preference: actor.preference,
      privateGoal: actor.privateGoal,
      contextSummary: actor.contextSummary,
      interactionCount: 0,
      latestActivity: "",
      messageCount: 0,
    })
  }
  for (const node of nodes) {
    const current = summaries.get(node.id)
    summaries.set(node.id, {
      id: node.id,
      name: current?.name ?? node.label,
      role: current?.role ?? node.role,
      intent: node.intent || current?.intent || "",
      backgroundHistory: current?.backgroundHistory ?? "",
      personality: current?.personality ?? "",
      preference: current?.preference ?? "",
      privateGoal: current?.privateGoal ?? "",
      contextSummary: current?.contextSummary ?? "",
      interactionCount: node.interactionCount,
      latestActivity: current?.latestActivity ?? "",
      messageCount: current?.messageCount ?? 0,
    })
  }
  for (const event of liveEvents) {
    if (event.type === "actors.ready") {
      for (const actor of event.actors) {
        if (!summaries.has(actor.id)) {
          summaries.set(actor.id, {
            id: actor.id,
            name: actor.label,
            role: actor.role,
            intent: actor.intent,
            backgroundHistory: "",
            personality: "",
            preference: "",
            privateGoal: "",
            contextSummary: "",
            interactionCount: actor.interactionCount,
            latestActivity: "",
            messageCount: 0,
          })
        }
      }
    }
  }
  for (const item of history) {
    const actorId = item.id.split(":")[0]
    const actor = actorId ? summaries.get(actorId) : undefined
    if (actor) {
      actor.latestActivity ||= item.content
      actor.messageCount += item.type === "message" ? 1 : 0
    }
  }
  return [...summaries.values()]
}

function buildActorNameMap(
  nodes: GraphNodeView[],
  liveEvents: RunEvent[],
  actors: Array<{ id: string; name: string }>
): Map<string, string> {
  const names = new Map<string, string>()
  for (const actor of actors) {
    names.set(actor.id, actor.name)
  }
  for (const node of nodes) {
    names.set(node.id, node.label)
  }
  for (const event of liveEvents) {
    if (event.type === "actors.ready") {
      for (const actor of event.actors) {
        names.set(actor.id, actor.label)
      }
    }
    if (event.type === "actor.message") {
      names.set(event.actorId, event.actorName)
    }
  }
  return names
}

function buildActorHistory(
  liveEvents: RunEvent[],
  stateInteractions: Interaction[],
  actorNames: Map<string, string>,
  t: UiTexts
): ActorHistoryItem[] {
  const items: ActorHistoryItem[] = []
  const seen = new Set<string>()

  for (const event of liveEvents) {
    if (event.type === "interaction.recorded") {
      addInteractionHistory(items, seen, event.interaction, actorNames, t, event.timestamp)
    }
    if (event.type === "actor.message") {
      addMessageHistory(items, seen, event.actorId, event.timestamp, t.actorMessage, event.content)
    }
    if (event.type === "model.message" && event.role === "actor") {
      const parsed = parseActorModelMessage(event.content, actorNames)
      if (parsed) {
        addMessageHistory(items, seen, parsed.actorId, event.timestamp, `${t.modelStep} ${parsed.step}`, parsed.content)
      }
    }
  }

  for (const interaction of stateInteractions) {
    addInteractionHistory(items, seen, interaction, actorNames, t)
  }

  return items.sort((a, b) => historySortValue(b) - historySortValue(a))
}

function addMessageHistory(
  items: ActorHistoryItem[],
  seen: Set<string>,
  actorId: string,
  timestamp: string,
  title: string,
  content: string
): void {
  const id = `${actorId}:message:${timestamp}:${title}:${content}`
  if (seen.has(id)) {
    return
  }
  seen.add(id)
  items.push({ id, type: "message", timestamp, title, content })
}

function addInteractionHistory(
  items: ActorHistoryItem[],
  seen: Set<string>,
  interaction: Interaction,
  actorNames: Map<string, string>,
  t: UiTexts,
  timestamp?: string
): void {
  const targetNames = interaction.targetActorIds.map((targetId) => actorNames.get(targetId) ?? targetId)
  const sourceName = actorNames.get(interaction.sourceActorId) ?? interaction.sourceActorId
  const sourceId = `${interaction.sourceActorId}:outgoing:${interaction.id}`
  if (!seen.has(sourceId)) {
    seen.add(sourceId)
    items.push({
      id: sourceId,
      type: "outgoing",
      roundIndex: interaction.roundIndex,
      timestamp,
      title: t.actionTaken,
      counterpart: `${t.to} ${targetNames.join(", ") || t.self}`,
      content: interaction.content,
      visibility: interaction.visibility,
      actionType: interaction.actionType,
    })
  }
  for (const targetId of interaction.targetActorIds) {
    const targetItemId = `${targetId}:incoming:${interaction.id}`
    if (seen.has(targetItemId)) {
      continue
    }
    seen.add(targetItemId)
    items.push({
      id: targetItemId,
      type: "incoming",
      roundIndex: interaction.roundIndex,
      timestamp,
      title: t.receivedInteraction,
      counterpart: `${t.from} ${sourceName}`,
      content: interaction.content,
      visibility: interaction.visibility,
      actionType: interaction.actionType,
    })
  }
}

function parseActorModelMessage(content: string, actorNames: Map<string, string>): { actorId: string; step: string; content: string } | undefined {
  const entries = [...actorNames.entries()].toSorted((a, b) => b[1].length - a[1].length)
  for (const [actorId, name] of entries) {
    if (!content.startsWith(`${name} `)) {
      continue
    }
    const rest = content.slice(name.length + 1)
    const separatorIndex = rest.indexOf(":")
    if (separatorIndex < 1) {
      continue
    }
    return {
      actorId,
      step: rest.slice(0, separatorIndex).trim(),
      content: rest.slice(separatorIndex + 1).trim(),
    }
  }
  return undefined
}

function filterHistory(history: ActorHistoryItem[], filter: HistoryFilter): ActorHistoryItem[] {
  return filter === "all" ? history : history.filter((item) => item.type === filter)
}

function buildHistoryStats(history: ActorHistoryItem[]): {
  total: number
  outgoing: number
  incoming: number
  messages: number
} {
  return {
    total: history.length,
    outgoing: history.filter((item) => item.type === "outgoing").length,
    incoming: history.filter((item) => item.type === "incoming").length,
    messages: history.filter((item) => item.type === "message").length,
  }
}

function historySortValue(item: ActorHistoryItem): number {
  if (item.timestamp) {
    const time = new Date(item.timestamp).getTime()
    if (Number.isFinite(time)) {
      return time
    }
  }
  return item.roundIndex ?? 0
}

function ActorField({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-4">
      <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
      <MarkdownContent className="mt-1" content={value} fallback="-" />
    </div>
  )
}

function ActorStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-background/70 px-2 py-2">
      <div className="font-mono text-base font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase text-muted-foreground">{label}</div>
    </div>
  )
}

function ActorSummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-background/70 p-3">
      <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
      <MarkdownContent compact className="mt-1 line-clamp-3 text-xs leading-5" content={value} fallback="-" />
    </div>
  )
}

function ActorHistoryCard({ item }: { item: ActorHistoryItem }) {
  const Icon = item.type === "outgoing" ? ArrowUpRightIcon : item.type === "incoming" ? ArrowDownLeftIcon : MessageSquareIcon
  return (
    <div className="rounded-md bg-background/80 p-3">
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md ${historyToneClass(item.type)}`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold">{item.title}</span>
            {item.roundIndex !== undefined ? (
              <Badge variant="secondary" className="h-4 rounded-sm px-1.5 text-[10px]">R{item.roundIndex}</Badge>
            ) : null}
            {item.visibility ? (
              <Badge variant="outline" className="h-4 rounded-sm bg-white px-1.5 text-[10px]">{item.visibility}</Badge>
            ) : null}
            {item.actionType ? (
              <Badge variant="outline" className="h-4 rounded-sm bg-white px-1.5 text-[10px]">{item.actionType}</Badge>
            ) : null}
          </div>
          {item.counterpart ? <p className="mt-1 truncate text-[11px] text-muted-foreground">{item.counterpart}</p> : null}
          <MarkdownContent compact className="mt-2" content={item.content} fallback="-" />
          {item.timestamp ? <time className="mt-2 block font-mono text-[10px] text-muted-foreground">{timeLabel(item.timestamp)}</time> : null}
        </div>
      </div>
    </div>
  )
}

function historyToneClass(type: ActorHistoryItem["type"]): string {
  if (type === "outgoing") return "bg-[#eef6ff] text-[#1f3a5f]"
  if (type === "incoming") return "bg-[#f0fdf4] text-[#166534]"
  return "bg-[#f5f3ff] text-[#4c1d95]"
}

function timeLabel(timestamp: string): string {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
