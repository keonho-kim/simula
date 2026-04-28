import { DEFAULT_EDGE_CURVATURE, indexParallelEdgesIndex } from "@sigma/edge-curve"
import forceAtlas2 from "graphology-layout-forceatlas2"
import type { GraphEdgeView, GraphNodeView } from "@simula/shared"
import { ACTIVE_COLOR, ACTOR_COLORS, LARGE_GRAPH_LABEL_THRESHOLD, MUTED_EDGE_COLOR, MUTED_NODE_COLOR } from "./constants"
import { EDGE_TYPE, type ActorGraph, type GraphEdgeAttributes, type GraphNodeAttributes, type Position } from "./types"
import { hashString } from "./math"

export function reduceNode(
  graph: ActorGraph,
  node: string,
  data: GraphNodeAttributes,
  state: { activeNodeIds: Set<string>; hoveredNodeId?: string; selectedNodeId?: string }
): Partial<GraphNodeAttributes> {
  const focusNodeId = state.selectedNodeId ?? state.hoveredNodeId
  const focusExists = Boolean(focusNodeId && graph.hasNode(focusNodeId))
  const related =
    !focusExists ||
    node === focusNodeId ||
    graph.hasEdge(node, focusNodeId as string) ||
    graph.hasEdge(focusNodeId as string, node)
  const active = state.activeNodeIds.has(node)
  return {
    ...data,
    color: active || node === focusNodeId ? ACTIVE_COLOR : related ? data.color : MUTED_NODE_COLOR,
    label: shouldRenderLabel(graph, related, active, data) ? data.label : "",
    size: active || node === focusNodeId ? data.size + 2 : data.size,
    zIndex: active || node === focusNodeId ? 2 : related ? 1 : 0,
  }
}

export function reduceEdge(
  graph: ActorGraph,
  edge: string,
  data: GraphEdgeAttributes,
  state: { hoveredNodeId?: string; selectedNodeId?: string }
): Partial<GraphEdgeAttributes> {
  const focusNodeId = state.selectedNodeId ?? state.hoveredNodeId
  if (!focusNodeId || !graph.hasNode(focusNodeId)) {
    return data
  }
  const source = graph.source(edge)
  const target = graph.target(edge)
  const related = source === focusNodeId || target === focusNodeId
  return {
    ...data,
    color: related ? data.color : MUTED_EDGE_COLOR,
    size: related ? data.size + 0.8 : Math.max(0.5, data.size * 0.45),
    zIndex: related ? 1 : 0,
  }
}

export function initialPosition(index: number, total = 1): Position {
  const angle = index * 2.399963229728653
  const radius = 2 + Math.sqrt(index + 1) * (total > 300 ? 2.8 : 1.8)
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  }
}

export function forceAtlasOptions(order: number): Parameters<typeof forceAtlas2.assign>[1] {
  return {
    iterations: order > 300 ? 12 : order > 100 ? 35 : 80,
    getEdgeWeight: "weight",
    settings: {
      barnesHutOptimize: order > 80,
      edgeWeightInfluence: 0.8,
      gravity: order > 300 ? 1.4 : 0.8,
      scalingRatio: order > 300 ? 24 : 12,
      slowDown: order > 300 ? 4 : 2,
    },
  }
}

export function nodeSize(node: GraphNodeView): number {
  return Math.min(14, 5 + Math.sqrt(node.interactionCount + 1) * 1.8)
}

export function actorColor(id: string): string {
  return ACTOR_COLORS[hashString(id) % ACTOR_COLORS.length] ?? ACTOR_COLORS[0]
}

export function edgeSize(edge: GraphEdgeView): number {
  return Math.min(5, 1 + edge.weight * 0.7)
}

export function edgeAlpha(visibility: GraphEdgeView["visibility"]): number {
  if (visibility === "public") return 0.62
  if (visibility === "semi-public") return 0.58
  if (visibility === "private") return 0.56
  return 0.42
}

export function edgeColor(visibility: GraphEdgeView["visibility"], alpha = edgeAlpha(visibility)): string {
  if (visibility === "public") return `rgba(59, 130, 246, ${alpha})`
  if (visibility === "semi-public") return `rgba(16, 185, 129, ${alpha})`
  if (visibility === "private") return `rgba(139, 92, 246, ${alpha})`
  return `rgba(100, 116, 139, ${alpha})`
}

export function applyEdgeCurves(graph: ActorGraph): void {
  indexParallelEdgesIndex(graph)
  graph.forEachEdge((edge, attributes) => {
    const curvature = typeof attributes.parallelIndex === "number" && typeof attributes.parallelMaxIndex === "number"
      ? parallelEdgeCurvature(attributes.parallelIndex, attributes.parallelMaxIndex)
      : DEFAULT_EDGE_CURVATURE
    graph.mergeEdgeAttributes(edge, { type: EDGE_TYPE, curvature })
  })
}

function shouldRenderLabel(graph: ActorGraph, related: boolean, active: boolean, data: GraphNodeAttributes): boolean {
  if (active) {
    return true
  }
  if (graph.order > LARGE_GRAPH_LABEL_THRESHOLD) {
    return related && data.size >= 10
  }
  return related || data.size >= 9
}

function parallelEdgeCurvature(index: number, maxIndex: number): number {
  if (maxIndex <= 0 || index === 0) {
    return DEFAULT_EDGE_CURVATURE
  }
  if (index < 0) {
    return -parallelEdgeCurvature(-index, maxIndex)
  }
  const amplitude = 3.5
  const maxCurvature = amplitude * (1 - Math.exp(-maxIndex / amplitude)) * DEFAULT_EDGE_CURVATURE
  return (maxCurvature * index) / maxIndex
}

