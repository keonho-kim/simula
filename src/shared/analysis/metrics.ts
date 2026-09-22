/**
 * Purpose: Calculate actor behavior diversity and coordinator event alignment metrics.
 * Pattern: Pure analysis module.
 * Usage: Composed by run-level analysis.
 * Related: src/shared/analysis/run.ts, src/shared/analysis/edges.ts
 */
import type { Interaction, SimulationState } from "@/shared/simulation"
import type { BehaviorDiversityMetric, CoordinatorAlignmentMetric } from "./types"
import { inferEventParticipants, validDirectedEdges } from "./edges"
import { entropy, intersectionSize, normalizedEntropy } from "./statistics"

export function calculateBehaviorDiversity(state: SimulationState): BehaviorDiversityMetric[] {
  const actorById = new Map(state.actors.map((actor) => [actor.id, actor]))
  const maxCounterparties = Math.max(0, state.actors.length - 1)

  return state.actors.map((actor) => {
    const actions = state.interactions
      .filter((interaction) => interaction.sourceActorId === actor.id && interaction.decisionType === "action")
      .sort(compareInteractionOrder)
    const actionTypes = frequency(actions.map((interaction) => interaction.actionType))
    const visibilities = frequency(actions.map((interaction) => interaction.visibility))
    const counterparties = new Set(
      actions.flatMap((interaction) =>
        interaction.targetActorIds.filter((targetActorId) => targetActorId !== actor.id && actorById.has(targetActorId))
      )
    )
    const repeatedTransitions = actions.slice(1).filter((interaction, index) => interaction.actionType === actions[index]?.actionType).length
    const transitionCount = Math.max(0, actions.length - 1)

    return {
      actorId: actor.id,
      actorName: actor.name,
      actionCount: actions.length,
      uniqueActionTypes: actionTypes.size,
      uniqueVisibilities: visibilities.size,
      uniqueCounterparties: counterparties.size,
      actionTypeEntropy: entropy([...actionTypes.values()]),
      normalizedActionTypeEntropy: normalizedEntropy([...actionTypes.values()]),
      visibilityEntropy: entropy([...visibilities.values()]),
      normalizedVisibilityEntropy: normalizedEntropy([...visibilities.values()]),
      targetSpread: maxCounterparties > 0 ? counterparties.size / maxCounterparties : 0,
      consecutiveRepeatRate: transitionCount > 0 ? repeatedTransitions / transitionCount : 0,
    }
  })
}

export function calculateCoordinatorAlignment(state: SimulationState): CoordinatorAlignmentMetric[] {
  const actorById = new Map(state.actors.map((actor) => [actor.id, actor]))
  const edges = validDirectedEdges(state.interactions, actorById)

  return (state.plan?.majorEvents ?? []).map((event) => {
    const eventEdges = edges.filter((edge) => edge.eventId === event.id)
    const actualParticipants = new Set<string>()
    for (const edge of eventEdges) {
      actualParticipants.add(edge.sourceActorId)
      actualParticipants.add(edge.targetActorId)
    }
    const explicitParticipants = new Set(event.participantIds.filter((actorId) => actorById.has(actorId)))
    const inferredParticipants = inferEventParticipants(event, state.actors)
    const plannedParticipants = explicitParticipants.size || inferredParticipants.size
      ? new Set([...explicitParticipants, ...inferredParticipants])
      : new Set(actualParticipants)
    const overlap = intersectionSize(plannedParticipants, actualParticipants)
    const union = new Set([...plannedParticipants, ...actualParticipants])

    return {
      eventId: event.id,
      title: event.title,
      status: event.status,
      plannedParticipantCount: plannedParticipants.size,
      actualParticipantCount: actualParticipants.size,
      overlapCount: overlap,
      jaccardAlignment: union.size ? overlap / union.size : 0,
      interactionCount: eventEdges.length,
      injectedRounds: state.roundDigests
        .filter((digest) => digest.injectedEventId === event.id)
        .map((digest) => digest.roundIndex),
    }
  })
}

function compareInteractionOrder(left: Interaction, right: Interaction): number {
  return left.roundIndex - right.roundIndex || left.id.localeCompare(right.id)
}

function frequency<T extends string>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}
