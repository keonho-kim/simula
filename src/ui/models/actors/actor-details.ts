/**
 * Purpose: Project actor profiles, names, and reasoning separately from activity history.
 * Pattern: Pure presentation transformations.
 * Usage: Consumed by the actor detail hook.
 * Related: src/ui/models/actors/actor-history.ts, src/ui/components/actors/history/use-actor-details.ts
 */
import type { ActorHistoryItem } from "./actor-history"
import type { ActorState, GraphNodeView, RunEvent } from "@/shared"
import { createActorTextSanitizer } from "@/ui/models/actors/actor-visible-text"

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
      actor.messageCount += item.hasSpeech ? 1 : 0
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
