import { DEFAULT_EDGE_CURVATURE, indexParallelEdgesIndex } from "@sigma/edge-curve"
import forceAtlas2 from "graphology-layout-forceatlas2"
import type { GraphEdgeView } from "@simula/shared"
import { LARGE_GRAPH_LABEL_THRESHOLD, MUTED_EDGE_COLOR, MUTED_NODE_COLOR } from "./constants"
import { EDGE_TYPE, type ActorGraph, type GraphEdgeAttributes, type GraphNodeAttributes, type Position } from "./types"

export function reduceNode(
  graph: ActorGraph,
  node: string,
  data: GraphNodeAttributes,
  state: {
    activeNodeIds: Set<string>
    highlightedNodeDepths: Map<string, number>
    hoveredNodeId?: string
    selectedNodeId?: string
    selectedEdgeId?: string
  }
): Partial<GraphNodeAttributes> {
  const focusNodeId = state.selectedNodeId ?? state.hoveredNodeId
  const focusNodeExists = Boolean(focusNodeId && graph.hasNode(focusNodeId))
  const focusEdgeExists = Boolean(state.selectedEdgeId && graph.hasEdge(state.selectedEdgeId))
  const related = focusEdgeExists
    ? graph.source(state.selectedEdgeId as string) === node || graph.target(state.selectedEdgeId as string) === node
    : state.selectedNodeId
      ? state.highlightedNodeDepths.has(node)
      : !focusNodeExists ||
        node === focusNodeId ||
        graph.hasEdge(node, focusNodeId as string) ||
        graph.hasEdge(focusNodeId as string, node)
  const active = state.activeNodeIds.has(node)
  const selectedDepth = state.highlightedNodeDepths.get(node)
  const renderLabel = shouldRenderLabel(graph, related, active || selectedDepth !== undefined, data)
  return {
    ...data,
    color: active || node === focusNodeId ? graphIntensityColor(Math.max(data.interactionCount, data.degree)) : related ? data.color : MUTED_NODE_COLOR,
    label: renderLabel ? data.label : "",
    forceLabel: renderLabel,
    size: active || node === focusNodeId ? data.size + 4 : selectedDepth === 1 ? data.size + 2 : data.size,
    zIndex: active || node === focusNodeId ? 3 : selectedDepth === 1 ? 2 : related ? 1 : 0,
  }
}

export function reduceEdge(
  graph: ActorGraph,
  edge: string,
  data: GraphEdgeAttributes,
  state: {
    highlightedNodeDepths: Map<string, number>
    hoveredNodeId?: string
    selectedNodeId?: string
    hoveredEdgeId?: string
    selectedEdgeId?: string
  }
): Partial<GraphEdgeAttributes> {
  const focusEdgeId = state.selectedEdgeId ?? state.hoveredEdgeId
  if (focusEdgeId) {
    const selected = edge === focusEdgeId
    return {
      ...data,
      color: selected ? edgeColor(data.weight, 0.96) : MUTED_EDGE_COLOR,
      size: selected ? data.size + 2.5 : Math.max(0.7, data.size * 0.28),
      zIndex: selected ? 2 : 0,
    }
  }
  const focusNodeId = state.selectedNodeId ?? state.hoveredNodeId
  if (!focusNodeId || !graph.hasNode(focusNodeId)) {
    return data
  }
  const source = graph.source(edge)
  const target = graph.target(edge)
  const related = state.selectedNodeId
    ? isDepthSelectedEdge(source, target, state.highlightedNodeDepths)
    : source === focusNodeId || target === focusNodeId
  return {
    ...data,
    color: related ? edgeColor(data.weight, 0.9) : MUTED_EDGE_COLOR,
    size: related ? data.size + 1.8 : Math.max(0.7, data.size * 0.32),
    zIndex: related ? 1 : 0,
  }
}

export function collectNodeDepths(graph: ActorGraph | null, nodeId: string | undefined, maxDepth: number): Map<string, number> {
  if (!graph || !nodeId || !graph.hasNode(nodeId)) {
    return new Map()
  }
  const depths = new Map([[nodeId, 0]])
  let frontier = [nodeId]
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const next: string[] = []
    for (const node of frontier) {
      for (const neighbor of graph.neighbors(node)) {
        if (!depths.has(neighbor)) {
          depths.set(neighbor, depth)
          next.push(neighbor)
        }
      }
    }
    frontier = next
  }
  return depths
}

export function initialPosition(index: number, total = 1): Position {
  const angle = index * 2.399963229728653
  const radius = 3 + Math.sqrt(index + 1) * (total > 300 ? 3.6 : 2.4)
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  }
}

export function forceAtlasOptions(order: number): Parameters<typeof forceAtlas2.assign>[1] {
  return {
    iterations: order > 300 ? 18 : order > 100 ? 45 : 100,
    getEdgeWeight: "weight",
    settings: {
      adjustSizes: true,
      barnesHutOptimize: order > 80,
      edgeWeightInfluence: 0.45,
      gravity: order > 300 ? 1.05 : order > 100 ? 0.75 : 0.55,
      scalingRatio: order > 300 ? 36 : order > 100 ? 22 : 16,
      slowDown: order > 300 ? 5 : 2.5,
    },
  }
}

export function nodeSize(degree: number, interactionCount = 0): number {
  const structuralSize = Math.sqrt(Math.max(0, degree) + 1) * 1.8
  const activitySize = Math.sqrt(Math.max(0, interactionCount)) * 4.4
  return Math.min(38, 8 + structuralSize + activitySize)
}

export function edgeSize(edge: GraphEdgeView): number {
  return Math.min(22, 3.2 + Math.sqrt(Math.max(0, edge.weight)) * 3.35)
}

export function edgeAlpha(weight: number): number {
  const level = intensityLevel(weight)
  if (level === "none") return 0.58
  if (level === "low") return 0.86
  if (level === "medium") return 0.9
  if (level === "high") return 0.95
  return 0.98
}

export function graphIntensityColor(value: number): string {
  const level = intensityLevel(value)
  if (level === "none") return MUTED_NODE_COLOR
  if (level === "low") return "#93c5fd"
  if (level === "medium") return "#4c8df6"
  if (level === "high") return "#6d5bd0"
  return "#be3455"
}

export function edgeColor(weight: number, alpha = edgeAlpha(weight)): string {
  const level = intensityLevel(weight)
  if (level === "none") return `rgba(52, 64, 84, ${alpha})`
  if (level === "low") return `rgba(37, 99, 235, ${alpha})`
  if (level === "medium") return `rgba(13, 148, 136, ${alpha})`
  if (level === "high") return `rgba(124, 58, 237, ${alpha})`
  return `rgba(225, 29, 72, ${alpha})`
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
    return related && data.size >= 9
  }
  return related || data.size >= 8
}

function isDepthSelectedEdge(source: string, target: string, nodeDepths: Map<string, number>): boolean {
  const sourceDepth = nodeDepths.get(source)
  const targetDepth = nodeDepths.get(target)
  if (sourceDepth === undefined || targetDepth === undefined) {
    return false
  }
  return Math.min(sourceDepth, targetDepth) <= 1 && Math.abs(sourceDepth - targetDepth) <= 1
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

function intensityLevel(value: number): "none" | "low" | "medium" | "high" | "veryHigh" {
  if (value <= 0) return "none"
  if (value <= 2) return "low"
  if (value <= 5) return "medium"
  if (value <= 10) return "high"
  return "veryHigh"
}
