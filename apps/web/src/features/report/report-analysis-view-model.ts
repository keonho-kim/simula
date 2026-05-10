import { calculateRunAnalysis, type RunAnalysis, type SimulationState } from "@simula/shared"

export interface RelationshipHeatmapRow {
  actorId: string
  actorName: string
  cells: number[]
}

export interface ReportAnalysisViewModel {
  analysis: RunAnalysis
  hasNetworkData: boolean
  topActors: RunAnalysis["network"]["actorMetrics"]
  strongestDyads: RunAnalysis["network"]["relationshipMetrics"]
  behaviorRanking: RunAnalysis["behavior"]
  eventAlignment: RunAnalysis["coordinator"]
  heatmapActors: Array<{ actorId: string; actorName: string }>
  heatmapRows: RelationshipHeatmapRow[]
  maxRelationshipWeight: number
}

export function buildReportAnalysisViewModel(state: SimulationState | undefined): ReportAnalysisViewModel | undefined {
  if (!state) {
    return undefined
  }

  const analysis = calculateRunAnalysis(state)
  const heatmapActors = state.actors.map((actor) => ({ actorId: actor.id, actorName: actor.name }))
  const relationshipWeights = new Map(
    analysis.network.relationshipMetrics.map((relationship) => [
      relationshipKey(relationship.sourceActorId, relationship.targetActorId),
      relationship.totalWeight,
    ])
  )
  const heatmapRows = heatmapActors.map((rowActor) => ({
    ...rowActor,
    cells: heatmapActors.map((columnActor) =>
      rowActor.actorId === columnActor.actorId
        ? 0
        : relationshipWeights.get(relationshipKey(rowActor.actorId, columnActor.actorId)) ?? 0
    ),
  }))

  return {
    analysis,
    hasNetworkData: analysis.network.summary.validActionCount > 0,
    topActors: analysis.network.actorMetrics.slice(0, 8),
    strongestDyads: analysis.network.relationshipMetrics.slice(0, 8),
    behaviorRanking: [...analysis.behavior]
      .sort((left, right) => right.actionCount - left.actionCount || left.actorName.localeCompare(right.actorName))
      .slice(0, 8),
    eventAlignment: analysis.coordinator,
    heatmapActors,
    heatmapRows,
    maxRelationshipWeight: Math.max(0, ...analysis.network.relationshipMetrics.map((relationship) => relationship.totalWeight)),
  }
}

function relationshipKey(left: string, right: string): string {
  return left.localeCompare(right) <= 0 ? `${left}\u0000${right}` : `${right}\u0000${left}`
}
