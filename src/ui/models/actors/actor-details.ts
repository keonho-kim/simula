import type { ActorState, GraphNodeView, Interaction, RunEvent } from "@/shared"
import type { UiTexts } from "@/ui/types/i18n"
import { createActorTextSanitizer, sanitizeActorVisibleText } from "@/ui/models/actors/actor-visible-text"

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

export function buildActorSummaries(
  stateActors: ActorState[],
  nodes: GraphNodeView[],
  actorEvents: RunEvent[],
  history: ActorHistoryItem[]
): ActorSummary[] {
  const actorNames = buildActorNameMap(nodes, actorEvents, stateActors)
  const clean = createActorTextSanitizer(actorNames, stateActors)
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

export function buildActorNameMap(
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

export function buildHistoryStats(history: ActorHistoryItem[]): {
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
