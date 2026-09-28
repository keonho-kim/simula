/**
 * Purpose: Merge accepted interactions and speech into distinct, localized actor activity records.
 * Pattern: Pure presentation projection.
 * Usage: Used by actor detail panels for history, filters, and counts.
 * Related: src/ui/models/actors/actor-details.ts, src/shared/run.ts
 */
import type { ActorState, Interaction, RunEvent } from "@/shared"
import type { UiTexts } from "@/ui/types/i18n"
import { createActorTextSanitizer, sanitizeActorVisibleText } from "./actor-visible-text"

export type HistoryFilter = "all" | "outgoing" | "incoming" | "message"

export interface ActorHistoryItem {
  id: string
  type: "outgoing" | "incoming" | "message"
  roundIndex?: number
  timestamp?: string
  title: string
  counterpartName: string
  content: string
  activity: "conversation" | "solitary" | "held"
  hasSpeech: boolean
  visibility?: Interaction["visibility"]
  actionType?: string
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

  const accepted = new Map<string, { interaction: Interaction; timestamp?: string }>(stateInteractions.map(interaction => [interaction.id, { interaction }]))
  for (const event of actorEvents) {
    if (event.type === "interaction.recorded") accepted.set(event.interaction.id, { interaction: event.interaction, timestamp: event.timestamp })
  }
  for (const { interaction, timestamp } of accepted.values()) addInteractionHistory(items, seen, interaction, actorNames, t, actors, timestamp)
  const byId = new Map(items.map(item => [item.id, item]))
  const clean = createActorTextSanitizer(actorNames, actors)
  const speechKey = (actorId: string, text: string, round?: number) => {
    const name = actorNames.get(actorId) ?? actorId
    const content = clean(text)
    return JSON.stringify([actorId, round, content.startsWith(`${name}: `) ? content.slice(name.length + 2) : content])
  }
  const matches = new Map<string, Interaction | null>()
  for (const { interaction } of accepted.values()) {
    for (const round of [interaction.roundIndex, undefined]) {
      const key = speechKey(interaction.sourceActorId, interaction.content, round)
      matches.set(key, matches.has(key) ? null : interaction)
    }
  }

  let currentRoundIndex: number | undefined
  for (const event of actorEvents) {
    if (event.type === "interaction.recorded") currentRoundIndex = event.interaction.roundIndex
    if (event.type !== "actor.message") continue
    const round = event.roundIndex ?? currentRoundIndex
    const linked = event.interactionId ? accepted.get(event.interactionId)?.interaction
      : matches.get(speechKey(event.actorId, event.content, round))
    if (linked?.sourceActorId === event.actorId) {
      const row = byId.get(`${event.actorId}:outgoing:${linked.id}`)
      if (row && row.activity === "conversation") row.hasSpeech = true
      continue
    }
    addMessageHistory(items, seen, event.actorId, event.timestamp, round, t.actorHistoryConversation, "", clean(event.content))
  }

  return items.sort(compareHistoryItems)
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
  const id = `${actorId}:message:${roundIndex ?? "unknown"}:${timestamp}:${title}:${content}`
  if (seen.has(id)) {
    return
  }
  seen.add(id)
  items.push({ id, type: "message", roundIndex, timestamp, title, counterpartName, content, activity: "conversation", hasSpeech: true })
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
  const targets = interaction.visibility === "solitary" || interaction.decisionType === "no_action" ? [] : interaction.targetActorIds
  const targetNames = targets
    .filter((targetId) => targetId !== interaction.sourceActorId)
    .map((targetId) => actorNames.get(targetId) ?? targetId)
  const sourceName = actorNames.get(interaction.sourceActorId) ?? interaction.sourceActorId
  const sourceId = `${interaction.sourceActorId}:outgoing:${interaction.id}`
  const activity = interaction.decisionType === "no_action" ? "held" : interaction.visibility === "solitary" ? "solitary" : "conversation"
  const title = activity === "held" ? t.actorHistoryHeld : activity === "solitary" ? t.actorRailSolitaryAction : t.actorHistoryConversation
  const counterpartName = targetNames.join(", ")
  const hasSpeech = activity === "conversation" && interaction.content.startsWith(`${sourceName}: `)
  if (!seen.has(sourceId)) {
    seen.add(sourceId)
    items.push({
      id: sourceId,
      type: "outgoing",
      roundIndex: interaction.roundIndex,
      timestamp,
      title,
      activity,
      hasSpeech,
      counterpartName,
      content: sanitizeActorVisibleText(interaction.content, actorNames, actors),
      visibility: interaction.visibility,
      actionType: interaction.decisionType === "no_action" ? undefined : interaction.actionType,
    })
  }
  for (const targetId of targets) {
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
      title,
      activity,
      hasSpeech: false,
      counterpartName: sourceName,
      content: sanitizeActorVisibleText(interaction.content, actorNames, actors),
      visibility: interaction.visibility,
      actionType: interaction.decisionType === "no_action" ? undefined : interaction.actionType,
    })
  }
}

export function filterHistory(history: ActorHistoryItem[], filter: HistoryFilter): ActorHistoryItem[] {
  return filter === "all" ? history : history.filter(item => filter === "message" ? item.hasSpeech : item.type === filter)
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
    messages: history.filter(item => item.hasSpeech).length,
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
