/**
 * Purpose: Project valid directed interaction edges and shared lookup keys.
 * Pattern: Projection.
 * Usage: Imported by network and coordinator analysis calculations.
 * Related: src/shared/simulation.ts, src/shared/analysis/network.ts
 */
import type { ActionVisibility, ActorState, Interaction, PlannedEvent } from "@/shared/simulation"

export interface DirectedEdge {
  sourceActorId: string
  targetActorId: string
  visibility: ActionVisibility
  roundIndex: number
  eventId: string
  actionType: string
}

export function validDirectedEdges(interactions: Interaction[], actorById: Map<string, ActorState>): DirectedEdge[] {
  return interactions.flatMap((interaction) => {
    if (interaction.decisionType === "no_action" || !actorById.has(interaction.sourceActorId)) {
      return []
    }
    return interaction.targetActorIds
      .filter((targetActorId) => targetActorId !== interaction.sourceActorId && actorById.has(targetActorId))
      .map((targetActorId) => ({
        sourceActorId: interaction.sourceActorId,
        targetActorId,
        visibility: interaction.visibility,
        roundIndex: interaction.roundIndex,
        eventId: interaction.eventId,
        actionType: interaction.actionType,
      }))
  })
}

export function uniqueDirectedTieCount(edges: DirectedEdge[]): number {
  return new Set(edges.map((edge) => `${edge.sourceActorId}\u0000${edge.targetActorId}`)).size
}

export function inferEventParticipants(event: PlannedEvent, actors: ActorState[]): Set<string> {
  const text = `${event.title}\n${event.summary}`.toLowerCase()
  return new Set(
    actors
      .filter((actor) => text.includes(actor.name.toLowerCase()))
      .map((actor) => actor.id)
  )
}

export function orderedPair(left: string, right: string): [string, string] {
  return left.localeCompare(right) <= 0 ? [left, right] : [right, left]
}

export function directionKey(sourceActorId: string, targetActorId: string): string {
  return `${sourceActorId}->${targetActorId}`
}

export function actorName(actorById: Map<string, ActorState>, actorId: string): string {
  return actorById.get(actorId)?.name ?? actorId
}
