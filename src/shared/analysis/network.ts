/**
 * Purpose: Calculate actor, relationship, round, and topology network metrics.
 * Pattern: Pure analysis module.
 * Usage: Called by report rendering and browser analysis view models.
 * Related: src/shared/analysis/edges.ts, src/shared/analysis/types.ts
 */
import type { ActionVisibility, ActorState, SimulationState } from "@/shared/simulation"
import type { NetworkActorMetric, NetworkDynamics, NetworkRelationshipMetric, NetworkRoundMetric } from "./types"
import {
  actorName,
  directionKey,
  orderedPair,
  uniqueDirectedTieCount,
  validDirectedEdges,
  type DirectedEdge,
} from "./edges"
import { average, gini, hhi } from "./statistics"

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
  const adjacency = buildUndirectedAdjacency(state.actors, edges)
  const componentSizes = connectedComponentSizes(state.actors, adjacency)
  const tieWeights = relationshipMetrics.map((relationship) => relationship.totalWeight)
  const directedTieCount = uniqueDirectedTieCount(edges)

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
      directedDensity: directedDensity(state.actors.length, directedTieCount),
      undirectedDensity: undirectedDensity(state.actors.length, relationshipMetrics.length),
      reciprocity: relationshipMetrics.length ? reciprocalPairs.length / relationshipMetrics.length : 0,
      clusteringCoefficient: averageLocalClustering(state.actors, adjacency),
      connectedComponentCount: componentSizes.length,
      largestComponentSize: Math.max(0, ...componentSizes),
      isolateCount: state.actors.filter((actor) => (adjacency.get(actor.id)?.size ?? 0) === 0).length,
      degreeCentralization: degreeCentralization(state.actors, adjacency),
      tieStrengthGini: gini(tieWeights),
      tieStrengthHhi: hhi(tieWeights),
    },
  }
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

function buildUndirectedAdjacency(actors: ActorState[], edges: DirectedEdge[]): Map<string, Set<string>> {
  const adjacency = new Map(actors.map((actor) => [actor.id, new Set<string>()]))
  for (const edge of edges) {
    adjacency.get(edge.sourceActorId)?.add(edge.targetActorId)
    adjacency.get(edge.targetActorId)?.add(edge.sourceActorId)
  }
  return adjacency
}

function connectedComponentSizes(actors: ActorState[], adjacency: Map<string, Set<string>>): number[] {
  const seen = new Set<string>()
  const sizes: number[] = []

  for (const actor of actors) {
    if (seen.has(actor.id)) {
      continue
    }
    const stack = [actor.id]
    let size = 0
    seen.add(actor.id)
    while (stack.length) {
      const actorId = stack.pop()
      if (!actorId) {
        continue
      }
      size += 1
      for (const neighborId of adjacency.get(actorId) ?? []) {
        if (!seen.has(neighborId)) {
          seen.add(neighborId)
          stack.push(neighborId)
        }
      }
    }
    sizes.push(size)
  }

  return sizes
}

function averageLocalClustering(actors: ActorState[], adjacency: Map<string, Set<string>>): number {
  const coefficients = actors.flatMap((actor) => {
    const neighbors = [...(adjacency.get(actor.id) ?? [])]
    if (neighbors.length < 2) {
      return []
    }
    let neighborTies = 0
    for (let left = 0; left < neighbors.length; left += 1) {
      for (let right = left + 1; right < neighbors.length; right += 1) {
        if (adjacency.get(neighbors[left] ?? "")?.has(neighbors[right] ?? "")) {
          neighborTies += 1
        }
      }
    }
    return [neighborTies / ((neighbors.length * (neighbors.length - 1)) / 2)]
  })

  return average(coefficients)
}

function degreeCentralization(actors: ActorState[], adjacency: Map<string, Set<string>>): number {
  if (actors.length <= 2) {
    return 0
  }
  const degrees = actors.map((actor) => adjacency.get(actor.id)?.size ?? 0)
  const maxDegree = Math.max(0, ...degrees)
  const numerator = degrees.reduce((total, degree) => total + maxDegree - degree, 0)
  return numerator / ((actors.length - 1) * (actors.length - 2))
}

function directedDensity(actorCount: number, edgeCount: number): number {
  return actorCount > 1 ? edgeCount / (actorCount * (actorCount - 1)) : 0
}

function undirectedDensity(actorCount: number, dyadCount: number): number {
  return actorCount > 1 ? dyadCount / ((actorCount * (actorCount - 1)) / 2) : 0
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

function reciprocityScore(relationship: NetworkRelationshipMetric): number {
  const counts = Object.values(relationship.directionCounts)
  return counts.length ? Math.min(...counts) : 0
}
