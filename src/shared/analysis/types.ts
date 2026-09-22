/**
 * Purpose: Define serializable network, behavior, coordinator, and run analysis contracts.
 * Pattern: Shared contract.
 * Usage: Imported by analysis calculations and report presentation models.
 * Related: src/shared/analysis/network.ts, src/shared/analysis/metrics.ts
 */
import type { ActionVisibility, PlannedEvent } from "@/shared/simulation"

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
