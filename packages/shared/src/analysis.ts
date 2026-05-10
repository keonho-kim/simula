import type { ActionVisibility, ActorState, Interaction, PlannedEvent, SimulationState } from "./simulation"

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
    directedDensity: number
    undirectedDensity: number
    reciprocity: number
    clusteringCoefficient: number
    connectedComponentCount: number
    largestComponentSize: number
    isolateCount: number
    degreeCentralization: number
    tieStrengthGini: number
    tieStrengthHhi: number
  }
}

export interface BehaviorDiversityMetric {
  actorId: string
  actorName: string
  actionCount: number
  uniqueActionTypes: number
  uniqueVisibilities: number
  uniqueCounterparties: number
  actionTypeEntropy: number
  normalizedActionTypeEntropy: number
  visibilityEntropy: number
  normalizedVisibilityEntropy: number
  targetSpread: number
  consecutiveRepeatRate: number
}

export interface CoordinatorAlignmentMetric {
  eventId: string
  title: string
  status: PlannedEvent["status"]
  plannedParticipantCount: number
  actualParticipantCount: number
  overlapCount: number
  jaccardAlignment: number
  interactionCount: number
  injectedRounds: number[]
}

export interface RunAnalysis {
  network: NetworkDynamics
  behavior: BehaviorDiversityMetric[]
  coordinator: CoordinatorAlignmentMetric[]
  summary: {
    averageActionEntropy: number
    averageVisibilityEntropy: number
    averageRepeatRate: number
    averageEventAlignment: number
    completedEventCount: number
    totalEventCount: number
  }
}

interface DirectedEdge {
  sourceActorId: string
  targetActorId: string
  visibility: ActionVisibility
  roundIndex: number
  eventId: string
  actionType: string
}

export function calculateRunAnalysis(state: SimulationState): RunAnalysis {
  const network = calculateNetworkDynamics(state)
  const behavior = calculateBehaviorDiversity(state)
  const coordinator = calculateCoordinatorAlignment(state)

  return {
    network,
    behavior,
    coordinator,
    summary: {
      averageActionEntropy: average(behavior.map((metric) => metric.normalizedActionTypeEntropy)),
      averageVisibilityEntropy: average(behavior.map((metric) => metric.normalizedVisibilityEntropy)),
      averageRepeatRate: average(behavior.map((metric) => metric.consecutiveRepeatRate)),
      averageEventAlignment: average(coordinator.map((metric) => metric.jaccardAlignment)),
      completedEventCount: (state.plan?.majorEvents ?? []).filter((event) => event.status === "completed").length,
      totalEventCount: state.plan?.majorEvents.length ?? 0,
    },
  }
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
  const adjacency = buildUndirectedAdjacency(state.actors, edges)
  const componentSizes = connectedComponentSizes(state.actors, adjacency)
  const tieWeights = relationshipMetrics.map((relationship) => relationship.totalWeight)

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
      directedDensity: directedDensity(state.actors.length, edges.length),
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

function calculateBehaviorDiversity(state: SimulationState): BehaviorDiversityMetric[] {
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

function calculateCoordinatorAlignment(state: SimulationState): CoordinatorAlignmentMetric[] {
  const actorById = new Map(state.actors.map((actor) => [actor.id, actor]))
  const edges = validDirectedEdges(state.interactions, actorById)

  return (state.plan?.majorEvents ?? []).map((event) => {
    const plannedParticipants = new Set(event.participantIds.filter((actorId) => actorById.has(actorId)))
    const eventEdges = edges.filter((edge) => edge.eventId === event.id)
    const actualParticipants = new Set<string>()
    for (const edge of eventEdges) {
      actualParticipants.add(edge.sourceActorId)
      actualParticipants.add(edge.targetActorId)
    }
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
        eventId: interaction.eventId,
        actionType: interaction.actionType,
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

function compareInteractionOrder(left: Interaction, right: Interaction): number {
  return left.roundIndex - right.roundIndex || left.id.localeCompare(right.id)
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

function frequency<T extends string>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

function entropy(counts: number[]): number {
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (total <= 0) {
    return 0
  }
  return counts.reduce((sum, count) => {
    const probability = count / total
    return probability > 0 ? sum - probability * Math.log2(probability) : sum
  }, 0)
}

function normalizedEntropy(counts: number[]): number {
  const categoryCount = counts.filter((count) => count > 0).length
  if (categoryCount <= 1) {
    return 0
  }
  return entropy(counts) / Math.log2(categoryCount)
}

function gini(values: number[]): number {
  const positive = values.filter((value) => value > 0).sort((left, right) => left - right)
  const total = positive.reduce((sum, value) => sum + value, 0)
  if (!positive.length || total <= 0) {
    return 0
  }
  const weighted = positive.reduce((sum, value, index) => sum + (2 * (index + 1) - positive.length - 1) * value, 0)
  return weighted / (positive.length * total)
}

function hhi(values: number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0)
  if (total <= 0) {
    return 0
  }
  return values.reduce((sum, value) => {
    const share = value / total
    return sum + share * share
  }, 0)
}

function average(values: number[]): number {
  const finite = values.filter(Number.isFinite)
  if (!finite.length) {
    return 0
  }
  return finite.reduce((sum, value) => sum + value, 0) / finite.length
}

function intersectionSize(left: Set<string>, right: Set<string>): number {
  let count = 0
  for (const value of left) {
    if (right.has(value)) {
      count += 1
    }
  }
  return count
}
