import type { ActionVisibility, ActorState, Interaction, SimulationState } from "@simula/shared"

export interface NetworkActorMetric {
  actorId: string
  actorName: string
  role: string
  sentCount: number
  receivedCount: number
  weightedDegree: number
  uniqueCounterparties: number
  firstActiveRound?: number
  lastActiveRound?: number
  visibilityMix: Partial<Record<ActionVisibility, number>>
}

export interface NetworkRelationshipMetric {
  sourceActorId: string
  sourceName: string
  targetActorId: string
  targetName: string
  totalWeight: number
  directionCounts: Record<string, number>
  reciprocal: boolean
  firstRound: number
  lastRound: number
  visibilityMix: Partial<Record<ActionVisibility, number>>
}

export interface NetworkRoundMetric {
  roundIndex: number
  actionCount: number
  activeActorCount: number
  newTies: number
  strongestActorId?: string
  strongestActorName?: string
  strongestActorWeight: number
}

export interface NetworkDynamics {
  actorMetrics: NetworkActorMetric[]
  relationshipMetrics: NetworkRelationshipMetric[]
  roundMetrics: NetworkRoundMetric[]
  summary: {
    validActionCount: number
    totalRelationshipWeight: number
    reciprocalPairCount: number
    mostCentralActor?: NetworkActorMetric
    mostActiveDyad?: NetworkRelationshipMetric
    highestReciprocityPairs: NetworkRelationshipMetric[]
    networkConcentration: number
  }
}

interface DirectedEdge {
  sourceActorId: string
  targetActorId: string
  visibility: ActionVisibility
  roundIndex: number
}

export function calculateNetworkDynamics(state: SimulationState): NetworkDynamics {
  const actorById = new Map(state.actors.map((actor) => [actor.id, actor]))
  const edges = validDirectedEdges(state.interactions, actorById)
  const actorMetrics = buildActorMetrics(state.actors, edges)
  const relationshipMetrics = buildRelationshipMetrics(edges, actorById)
  const roundMetrics = buildRoundMetrics(edges, actorById)
  const totalRelationshipWeight = relationshipMetrics.reduce((total, relationship) => total + relationship.totalWeight, 0)
  const reciprocalPairs = relationshipMetrics.filter((relationship) => relationship.reciprocal)
  const highestReciprocityScore = Math.max(0, ...reciprocalPairs.map((relationship) => reciprocityScore(relationship)))
  const mostCentralActor = actorMetrics.find((metric) => metric.weightedDegree > 0)
  const mostActiveDyad = relationshipMetrics[0]
  const totalWeightedDegree = actorMetrics.reduce((total, metric) => total + metric.weightedDegree, 0)

  return {
    actorMetrics,
    relationshipMetrics,
    roundMetrics,
    summary: {
      validActionCount: edges.length,
      totalRelationshipWeight,
      reciprocalPairCount: reciprocalPairs.length,
      mostCentralActor,
      mostActiveDyad,
      highestReciprocityPairs: reciprocalPairs.filter((relationship) => reciprocityScore(relationship) === highestReciprocityScore),
      networkConcentration: totalWeightedDegree > 0 && mostCentralActor ? mostCentralActor.weightedDegree / totalWeightedDegree : 0,
    },
  }
}

function validDirectedEdges(interactions: Interaction[], actorById: Map<string, ActorState>): DirectedEdge[] {
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
      }))
  })
}

function buildActorMetrics(actors: ActorState[], edges: DirectedEdge[]): NetworkActorMetric[] {
  return actors
    .map((actor) => {
      const sentEdges = edges.filter((edge) => edge.sourceActorId === actor.id)
      const receivedEdges = edges.filter((edge) => edge.targetActorId === actor.id)
      const actorEdges = [...sentEdges, ...receivedEdges]
      const counterparties = new Set<string>()
      const visibilityMix: Partial<Record<ActionVisibility, number>> = {}
      const activeRounds = actorEdges.map((edge) => edge.roundIndex)

      for (const edge of actorEdges) {
        counterparties.add(edge.sourceActorId === actor.id ? edge.targetActorId : edge.sourceActorId)
        visibilityMix[edge.visibility] = (visibilityMix[edge.visibility] ?? 0) + 1
      }

      return {
        actorId: actor.id,
        actorName: actor.name,
        role: actor.role,
        sentCount: sentEdges.length,
        receivedCount: receivedEdges.length,
        weightedDegree: sentEdges.length + receivedEdges.length,
        uniqueCounterparties: counterparties.size,
        firstActiveRound: activeRounds.length ? Math.min(...activeRounds) : undefined,
        lastActiveRound: activeRounds.length ? Math.max(...activeRounds) : undefined,
        visibilityMix,
      }
    })
    .sort(compareActorMetric)
}

function buildRelationshipMetrics(
  edges: DirectedEdge[],
  actorById: Map<string, ActorState>
): NetworkRelationshipMetric[] {
  const byPair = new Map<string, NetworkRelationshipMetric>()

  for (const edge of edges) {
    const [leftId, rightId] = orderedPair(edge.sourceActorId, edge.targetActorId)
    const key = `${leftId}\u0000${rightId}`
    const left = actorById.get(leftId)
    const right = actorById.get(rightId)
    if (!left || !right) {
      continue
    }

    const relationship = byPair.get(key) ?? {
      sourceActorId: leftId,
      sourceName: left.name,
      targetActorId: rightId,
      targetName: right.name,
      totalWeight: 0,
      directionCounts: {
        [directionKey(leftId, rightId)]: 0,
        [directionKey(rightId, leftId)]: 0,
      },
      reciprocal: false,
      firstRound: edge.roundIndex,
      lastRound: edge.roundIndex,
      visibilityMix: {},
    }
    relationship.totalWeight += 1
    relationship.directionCounts[directionKey(edge.sourceActorId, edge.targetActorId)] =
      (relationship.directionCounts[directionKey(edge.sourceActorId, edge.targetActorId)] ?? 0) + 1
    relationship.firstRound = Math.min(relationship.firstRound, edge.roundIndex)
    relationship.lastRound = Math.max(relationship.lastRound, edge.roundIndex)
    relationship.visibilityMix[edge.visibility] = (relationship.visibilityMix[edge.visibility] ?? 0) + 1
    relationship.reciprocal =
      (relationship.directionCounts[directionKey(leftId, rightId)] ?? 0) > 0 &&
      (relationship.directionCounts[directionKey(rightId, leftId)] ?? 0) > 0
    byPair.set(key, relationship)
  }

  return [...byPair.values()].sort(compareRelationshipMetric)
}

function buildRoundMetrics(edges: DirectedEdge[], actorById: Map<string, ActorState>): NetworkRoundMetric[] {
  const rounds = new Map<number, DirectedEdge[]>()
  const seenPairs = new Set<string>()

  for (const edge of edges) {
    rounds.set(edge.roundIndex, [...(rounds.get(edge.roundIndex) ?? []), edge])
  }

  return [...rounds.entries()]
    .sort(([left], [right]) => left - right)
    .map(([roundIndex, roundEdges]) => {
      const activeActors = new Set<string>()
      const weights = new Map<string, number>()
      let newTies = 0

      for (const edge of roundEdges) {
        activeActors.add(edge.sourceActorId)
        activeActors.add(edge.targetActorId)
        weights.set(edge.sourceActorId, (weights.get(edge.sourceActorId) ?? 0) + 1)
        weights.set(edge.targetActorId, (weights.get(edge.targetActorId) ?? 0) + 1)

        const pairKey = orderedPair(edge.sourceActorId, edge.targetActorId).join("\u0000")
        if (!seenPairs.has(pairKey)) {
          seenPairs.add(pairKey)
          newTies += 1
        }
      }

      const strongest = [...weights.entries()].sort((left, right) => {
        const countDifference = right[1] - left[1]
        if (countDifference !== 0) {
          return countDifference
        }
        return actorName(actorById, left[0]).localeCompare(actorName(actorById, right[0]))
      })[0]

      return {
        roundIndex,
        actionCount: roundEdges.length,
        activeActorCount: activeActors.size,
        newTies,
        strongestActorId: strongest?.[0],
        strongestActorName: strongest ? actorName(actorById, strongest[0]) : undefined,
        strongestActorWeight: strongest?.[1] ?? 0,
      }
    })
}

function compareActorMetric(left: NetworkActorMetric, right: NetworkActorMetric): number {
  return (
    right.weightedDegree - left.weightedDegree ||
    right.sentCount - left.sentCount ||
    left.actorName.localeCompare(right.actorName)
  )
}

function compareRelationshipMetric(left: NetworkRelationshipMetric, right: NetworkRelationshipMetric): number {
  return (
    right.totalWeight - left.totalWeight ||
    right.lastRound - left.lastRound ||
    left.sourceName.localeCompare(right.sourceName) ||
    left.targetName.localeCompare(right.targetName)
  )
}

function orderedPair(left: string, right: string): [string, string] {
  return left.localeCompare(right) <= 0 ? [left, right] : [right, left]
}

function directionKey(sourceActorId: string, targetActorId: string): string {
  return `${sourceActorId}->${targetActorId}`
}

function actorName(actorById: Map<string, ActorState>, actorId: string): string {
  return actorById.get(actorId)?.name ?? actorId
}

function reciprocityScore(relationship: NetworkRelationshipMetric): number {
  const counts = Object.values(relationship.directionCounts)
  return counts.length ? Math.min(...counts) : 0
}
