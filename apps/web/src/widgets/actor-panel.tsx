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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { UiTexts } from "@/lib/i18n"
import { MarkdownContent } from "@/shared/ui/markdown-content"
import { useRunStore } from "@/store/run-store"
import { sanitizeActorVisibleText } from "./actor-visible-text"

export type HistoryFilter = "all" | "outgoing" | "incoming" | "message"

export interface ActorSummary {
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

export interface ActorHistoryItem {
  id: string
  type: "outgoing" | "incoming" | "message"
  roundIndex?: number
  timestamp?: string
  title: string
  counterpart?: string
  counterpartName: string
  content: string
  visibility?: Interaction["visibility"]
  actionType?: string
}

export interface ActorReasoningItem {
  id: string
  actorId: string
  step: string
  attempt: number
  timestamp: string
  content: string
  reasoningTokens: number
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
  const { actors, history, reasoning } = useActorPanelData(t)
  const actor = actors.find((item) => item.id === actorId)
  const actorHistory = useMemo(
    () => actorId ? filterHistory(history.filter((item) => item.id.startsWith(`${actorId}:`)), filter) : [],
    [actorId, filter, history]
  )
  const actorReasoning = useMemo(
    () => actorId ? reasoning.filter((item) => item.actorId === actorId) : [],
    [actorId, reasoning]
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

            <Tabs defaultValue="actor-info" className="min-h-0 flex-1 gap-3">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="actor-info">{t.actorInfoTab}</TabsTrigger>
                <TabsTrigger value="msg">{t.actorMessagesTab}</TabsTrigger>
              </TabsList>

              <TabsContent value="actor-info" className="min-h-0 overflow-hidden">
                <ScrollArea className="h-full pr-3">
                  <div className="grid gap-4 pr-3 lg:grid-cols-2">
                    <section className="rounded-md bg-muted/20 p-4">
                      <div className="flex items-center gap-2">
                        <BrainIcon className="size-4 text-muted-foreground" />
                        <h3 className="text-xs font-semibold uppercase text-muted-foreground">{t.actorInfoTab}</h3>
                      </div>
                      <ActorField label={t.actorBackground} value={actor.backgroundHistory} />
                      <ActorField label={t.actorPersonality} value={actor.personality} />
                      <ActorField label={t.actorPreference} value={actor.preference} />
                      <ActorField label={t.actorPrivateGoal} value={actor.privateGoal} />
                    </section>
                    <section className="rounded-md bg-muted/20 p-4">
                      <ActorSummaryField label={t.actorCurrentIntent} value={actor.intent || t.graphNoIntent} />
                      <div className="mt-3">
                        <ActorSummaryField label={t.actorLatestActivity} value={actor.latestActivity || t.waitingForActivity} />
                      </div>
                      <ActorField label={t.actorContextSummary} value={actor.contextSummary || t.actorNoCompressedContext} />
                    </section>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="msg" className="min-h-0 overflow-hidden">
                <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-md bg-muted/20">
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
                  <ActorReasoningStream items={actorReasoning} t={t} />
                  <ScrollArea className="min-h-0 flex-1 p-3">
                    {actorHistory.length ? (
                      <div className="flex flex-col gap-2 pr-3">
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
                  </ScrollArea>
                </section>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function useActorPanelData(t: UiTexts): { actors: ActorSummary[]; history: ActorHistoryItem[]; reasoning: ActorReasoningItem[] } {
  const timeline = useRunStore((state) => state.timeline)
  const replayIndex = useRunStore((state) => state.replayIndex)
  const actorEvents = useRunStore((state) => state.actorEvents)
  const runState = useRunStore((state) => state.runState)
  const frame = timeline[replayIndex] ?? timeline.at(-1)
  const actorNames = useMemo(() => buildActorNameMap(frame?.nodes ?? [], actorEvents, runState?.actors ?? []), [actorEvents, frame, runState?.actors])
  const history = useMemo(
    () => buildActorHistory(actorEvents, runState?.interactions ?? [], actorNames, t, runState?.actors ?? []),
    [actorEvents, actorNames, runState?.actors, runState?.interactions, t]
  )
  const reasoning = useMemo(() => buildActorReasoning(actorEvents), [actorEvents])
  const actors = useMemo(
    () => buildActorSummaries(runState?.actors ?? [], frame?.nodes ?? [], actorEvents, history),
    [actorEvents, frame?.nodes, history, runState?.actors]
  )
  return { actors, history, reasoning }
}

export function buildActorSummaries(
  stateActors: ActorState[],
  nodes: GraphNodeView[],
  actorEvents: RunEvent[],
  history: ActorHistoryItem[]
): ActorSummary[] {
  const actorNames = buildActorNameMap(nodes, actorEvents, stateActors)
  const clean = (value: string | undefined) => sanitizeActorVisibleText(value, actorNames, stateActors)
  const summaries = new Map<string, ActorSummary>()
  for (const actor of stateActors) {
    summaries.set(actor.id, {
      id: actor.id,
      name: actor.name,
      role: actor.role,
      intent: clean(actor.intent),
      backgroundHistory: actor.backgroundHistory,
      personality: actor.personality,
      preference: actor.preference,
      privateGoal: actor.privateGoal,
      contextSummary: clean(actor.contextSummary),
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
      intent: clean(node.intent) || current?.intent || "",
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
  for (const event of actorEvents) {
    if (event.type === "actors.ready") {
      for (const actor of event.actors) {
        const current = summaries.get(actor.id)
        summaries.set(actor.id, {
          id: actor.id,
          name: current?.name ?? actor.label,
          role: current?.role ?? actor.role,
          intent: current?.intent || clean(actor.intent),
          backgroundHistory: current?.backgroundHistory || actor.backgroundHistory || "",
          personality: current?.personality || actor.personality || "",
          preference: current?.preference || actor.preference || "",
          privateGoal: current?.privateGoal || actor.privateGoal || "",
          contextSummary: current?.contextSummary || clean(actor.contextSummary) || "",
          interactionCount: current?.interactionCount ?? actor.interactionCount,
          latestActivity: current?.latestActivity ?? "",
          messageCount: current?.messageCount ?? 0,
        })
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
  actorEvents: RunEvent[],
  actors: Array<{ id: string; name: string }>
): Map<string, string> {
  const names = new Map<string, string>()
  for (const actor of actors) {
    names.set(actor.id, actor.name)
  }
  for (const node of nodes) {
    names.set(node.id, node.label)
  }
  for (const event of actorEvents) {
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

export function buildActorHistory(
  actorEvents: RunEvent[],
  stateInteractions: Interaction[],
  actorNames: Map<string, string>,
  t: UiTexts,
  actors: ActorState[] = []
): ActorHistoryItem[] {
  const items: ActorHistoryItem[] = []
  const seen = new Set<string>()

  let currentRoundIndex: number | undefined
  for (const event of actorEvents) {
    if (event.type === "interaction.recorded") {
      currentRoundIndex = event.interaction.roundIndex
      addInteractionHistory(items, seen, event.interaction, actorNames, t, actors, event.timestamp)
    }
    if (event.type === "actor.message") {
      addMessageHistory(items, seen, event.actorId, event.timestamp, currentRoundIndex, t.actorMessage, t.self.toUpperCase(), sanitizeActorVisibleText(event.content, actorNames, actors))
    }
  }

  for (const interaction of stateInteractions) {
    addInteractionHistory(items, seen, interaction, actorNames, t, actors)
  }

  return items.sort(compareHistoryItems)
}

export function buildActorReasoning(actorEvents: RunEvent[]): ActorReasoningItem[] {
  return actorEvents
    .filter((event): event is Extract<RunEvent, { type: "model.reasoning" }> => event.type === "model.reasoning" && event.role === "actor" && Boolean(event.actorId))
    .map((event, index) => ({
      id: `${event.runId}:${event.actorId}:${event.step}:${event.attempt}:${event.timestamp}:${index}`,
      actorId: event.actorId ?? "",
      step: event.step,
      attempt: event.attempt,
      timestamp: event.timestamp,
      content: event.content,
      reasoningTokens: event.reasoningTokens,
    }))
}

function addMessageHistory(
  items: ActorHistoryItem[],
  seen: Set<string>,
  actorId: string,
  timestamp: string,
  roundIndex: number | undefined,
  title: string,
  counterpartName: string,
  content: string
): void {
  const id = `${actorId}:message:${timestamp}:${title}:${content}`
  if (seen.has(id)) {
    return
  }
  seen.add(id)
  items.push({ id, type: "message", roundIndex, timestamp, title, counterpartName, content })
}

function addInteractionHistory(
  items: ActorHistoryItem[],
  seen: Set<string>,
  interaction: Interaction,
  actorNames: Map<string, string>,
  t: UiTexts,
  actors: ActorState[],
  timestamp?: string
): void {
  const targetNames = interaction.targetActorIds
    .filter((targetId) => targetId !== interaction.sourceActorId)
    .map((targetId) => actorNames.get(targetId) ?? targetId)
  const sourceName = actorNames.get(interaction.sourceActorId) ?? interaction.sourceActorId
  const sourceId = `${interaction.sourceActorId}:outgoing:${interaction.id}`
  const counterpartName = interaction.decisionType === "no_action"
    ? "HELD"
    : targetNames.join(", ") || "SOLO"
  if (!seen.has(sourceId)) {
    seen.add(sourceId)
    items.push({
      id: sourceId,
      type: "outgoing",
      roundIndex: interaction.roundIndex,
      timestamp,
      title: t.actionTaken,
      counterpart: counterpartName,
      counterpartName,
      content: sanitizeActorVisibleText(interaction.content, actorNames, actors),
      visibility: interaction.visibility,
      actionType: interaction.actionType,
    })
  }
  for (const targetId of interaction.targetActorIds) {
    if (targetId === interaction.sourceActorId) {
      continue
    }

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
      counterpartName: sourceName,
      content: sanitizeActorVisibleText(interaction.content, actorNames, actors),
      visibility: interaction.visibility,
      actionType: interaction.actionType,
    })
  }
}

export function filterHistory(history: ActorHistoryItem[], filter: HistoryFilter): ActorHistoryItem[] {
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

function compareHistoryItems(a: ActorHistoryItem, b: ActorHistoryItem): number {
  const roundDelta = (b.roundIndex ?? -1) - (a.roundIndex ?? -1)
  if (roundDelta !== 0) {
    return roundDelta
  }
  return historySortValue(b) - historySortValue(a)
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
  const roundLabel = item.roundIndex === undefined ? "ROUND -" : `ROUND ${item.roundIndex}`
  return (
    <div className="rounded-md bg-background/80 p-3">
      <div className="flex items-start gap-2">
        <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md ${historyToneClass(item.type)}`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold uppercase">{roundLabel} | {item.counterpartName}</span>
            {item.visibility ? (
              <Badge variant="outline" className="h-4 rounded-sm bg-white px-1.5 text-[10px]">{item.visibility}</Badge>
            ) : null}
            {item.actionType ? (
              <Badge variant="outline" className="h-4 rounded-sm bg-white px-1.5 text-[10px]">{item.actionType}</Badge>
            ) : null}
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{item.title}</p>
          <MarkdownContent compact className="mt-2" content={item.content} fallback="-" />
          {item.timestamp ? <time className="mt-2 block font-mono text-[10px] text-muted-foreground">{timeLabel(item.timestamp)}</time> : null}
        </div>
      </div>
    </div>
  )
}

function ActorReasoningStream({ items, t }: { items: ActorReasoningItem[]; t: UiTexts }) {
  if (!items.length) {
    return null
  }
  return (
    <details className="border-b border-border/70 bg-background/60 px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold uppercase text-muted-foreground">
        {t.think} ({items.length})
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        {items.slice(-6).map((item) => (
          <details key={item.id} className="rounded-md bg-muted/30 p-3">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              {item.step} · attempt {item.attempt} · {timeLabel(item.timestamp)} · {item.reasoningTokens.toLocaleString()} tokens
            </summary>
            <MarkdownContent compact className="mt-2" content={item.content} fallback="-" />
          </details>
        ))}
      </div>
    </details>
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
