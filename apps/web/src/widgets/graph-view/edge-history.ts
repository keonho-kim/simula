import type { ActorState, GraphEdgeView, GraphNodeView, Interaction, RunEvent } from "@simula/shared"

export interface EdgeInteractionHistoryItem {
  id: string
  roundIndex: number
  timestamp?: string
  content: string
  actionType: string
  decisionType: Interaction["decisionType"]
  visibility: Interaction["visibility"]
  intent: string
  expectation: string
}

export function buildEdgeActorNames(
  nodes: GraphNodeView[],
  events: RunEvent[],
  actors: ActorState[]
): Map<string, string> {
  const names = new Map<string, string>()
  for (const actor of actors) {
    names.set(actor.id, actor.name)
  }
  for (const node of nodes) {
    names.set(node.id, node.label)
  }
  for (const event of events) {
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

export function buildEdgeInteractionHistory(
  edge: GraphEdgeView | undefined,
  events: RunEvent[],
  stateInteractions: Interaction[]
): EdgeInteractionHistoryItem[] {
  if (!edge) {
    return []
  }
  const seen = new Set<string>()
  const items: EdgeInteractionHistoryItem[] = []
  for (const event of events) {
    if (event.type === "interaction.recorded" && interactionMatchesEdge(event.interaction, edge)) {
      addInteraction(items, seen, event.interaction, event.timestamp)
    }
  }
  for (const interaction of stateInteractions) {
    if (interactionMatchesEdge(interaction, edge)) {
      addInteraction(items, seen, interaction)
    }
  }
  return items.toSorted((a, b) => historySortValue(b) - historySortValue(a))
}

export function interactionMatchesEdge(interaction: Interaction, edge: GraphEdgeView): boolean {
  return (
    interaction.sourceActorId === edge.source &&
    interaction.targetActorIds.includes(edge.target) &&
    interaction.visibility === edge.visibility
  )
}

function addInteraction(
  items: EdgeInteractionHistoryItem[],
  seen: Set<string>,
  interaction: Interaction,
  timestamp?: string
): void {
  if (seen.has(interaction.id)) {
    return
  }
  seen.add(interaction.id)
  items.push({
    id: interaction.id,
    roundIndex: interaction.roundIndex,
    timestamp,
    content: interaction.content,
    actionType: interaction.actionType,
    decisionType: interaction.decisionType,
    visibility: interaction.visibility,
    intent: interaction.intent,
    expectation: interaction.expectation,
  })
}

function historySortValue(item: EdgeInteractionHistoryItem): number {
  const roundValue = item.roundIndex * 1_000_000_000_000
  if (item.timestamp) {
    const time = new Date(item.timestamp).getTime()
    if (Number.isFinite(time)) {
      return roundValue + (time % 1_000_000_000_000)
    }
  }
  return roundValue
}
