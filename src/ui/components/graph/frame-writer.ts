import { sameGraphValue } from "@/ui/models/graph/timeline-sharing"
import type { MutableRefObject } from "react"
import type { GraphTimelineFrame } from "@/shared"
import { EDGE_ANIMATION_MS } from "@/ui/components/graph/constants"
import {
  cancelAnimation,
  cancelEdgeAnimation,
  queueEdgeAnimation,
} from "@/ui/components/graph/animation"
import { buildNodeDegree } from "@/ui/components/graph/node-degree"
import {
  applyEdgeCurves,
  edgeAlpha,
  edgeColor,
  edgeSize,
  graphIntensityColor,
  initialPosition,
  nodeSize,
} from "@/ui/components/graph/styles"
import { EDGE_TYPE, type ActorGraph, type EdgeAnimationState, type GraphEdgeAttributes, type GraphNodeAttributes, type LayoutAnimationState, type Position } from "@/ui/components/graph/types"

export function writeGraphFrame(
  graph: ActorGraph,
  frame: GraphTimelineFrame | undefined,
  nodePositions: Map<string, Position>,
  frameIndexRef: MutableRefObject<number | undefined>,
  layoutRoundRef: MutableRefObject<number | undefined>,
  layoutAnimation: LayoutAnimationState,
  edgeAnimation: EdgeAnimationState,
): boolean {
  if (!frame) {
    cancelAnimation(layoutAnimation)
    cancelEdgeAnimation(edgeAnimation)
    graph.clear()
    nodePositions.clear()
    frameIndexRef.current = undefined
    layoutRoundRef.current = undefined
    return true
  }
  let topologyChanged = false
  if (frame.index === 0 || (frameIndexRef.current !== undefined && frame.index < frameIndexRef.current)) {
    cancelAnimation(layoutAnimation)
    cancelEdgeAnimation(edgeAnimation)
    graph.clear()
    topologyChanged = true
    nodePositions.clear()
    frameIndexRef.current = undefined
    layoutRoundRef.current = undefined
  }
  frameIndexRef.current = frame.index

  const nodes = frame?.nodes ?? []
  const nextNodeIds = new Set(nodes.map((node) => node.id))
  for (const nodeId of graph.nodes()) {
    if (!nextNodeIds.has(nodeId)) {
      topologyChanged = true
      graph.dropNode(nodeId)
      nodePositions.delete(nodeId)
    }
  }

  const degreeByNode = buildNodeDegree(nodes, frame?.edges ?? [])
  nodes.forEach((node, index) => {
    const degree = degreeByNode.get(node.id) ?? 0
    const position = nodePositions.get(node.id) ?? initialPosition(index, nodes.length)
    const attributes: GraphNodeAttributes = {
      label: node.label,
      role: node.role,
      intent: node.intent,
      interactionCount: node.interactionCount,
      degree,
      size: nodeSize(degree, node.interactionCount),
      color: graphIntensityColor(node.interactionCount),
      x: position.x,
      y: position.y,
    }
    nodePositions.set(node.id, position)
    if (graph.hasNode(node.id)) {
      const next = {
        label: attributes.label,
        role: attributes.role,
        intent: attributes.intent,
        interactionCount: attributes.interactionCount,
        degree: attributes.degree,
        size: attributes.size,
        color: attributes.color,
      }
      const current = graph.getNodeAttributes(node.id)
      if (Object.entries(next).some(([key, value]) => !sameGraphValue(current[key as keyof typeof current], value))) graph.mergeNodeAttributes(node.id, next)
    } else {
      topologyChanged = true
      graph.addNode(node.id, attributes)
    }
  })

  const nextEdgeIds = new Set((frame?.edges ?? []).map((edge) => edge.id))
  for (const edgeId of graph.edges()) {
    if (!nextEdgeIds.has(edgeId)) {
      topologyChanged = true
      graph.dropEdge(edgeId)
      edgeAnimation.items.delete(edgeId)
    }
  }
  for (const edge of frame?.edges ?? []) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) {
      continue
    }
    const targetSize = edgeSize(edge)
    const targetAlpha = edgeAlpha(edge.weight)
    if (graph.hasEdge(edge.id)) {
      const current = { ...graph.getEdgeAttributes(edge.id) }
      const next: Partial<GraphEdgeAttributes> = {
        type: EDGE_TYPE,
        visibility: edge.visibility,
        visibilityMix: edge.visibilityMix,
        actionTypes: edge.actionTypes,
        latestContent: edge.latestContent,
        latestActionType: edge.latestActionType,
        weight: edge.weight,
      }
      if (Object.entries(next).some(([key, value]) => !sameGraphValue(current[key as keyof typeof current], value))) graph.mergeEdgeAttributes(edge.id, next)
      if (current.weight !== edge.weight || current.visibility !== edge.visibility) {
        queueEdgeAnimation(graph, edgeAnimation, edge.id, {
          weight: edge.weight,
          fromSize: current.size,
          toSize: targetSize,
          fromAlpha: current.alpha,
          toAlpha: targetAlpha,
          duration: EDGE_ANIMATION_MS,
        })
      }
      continue
    }
    const attributes: GraphEdgeAttributes = {
      type: EDGE_TYPE,
      color: edgeColor(edge.weight, 0.08),
      size: 0.2,
      alpha: 0.08,
      visibility: edge.visibility,
      visibilityMix: edge.visibilityMix,
      actionTypes: edge.actionTypes,
      latestContent: edge.latestContent,
      latestActionType: edge.latestActionType,
      weight: edge.weight,
    }
    topologyChanged = true
    graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, attributes)
    queueEdgeAnimation(graph, edgeAnimation, edge.id, {
      weight: edge.weight,
      fromSize: attributes.size,
      toSize: targetSize,
      fromAlpha: attributes.alpha,
      toAlpha: targetAlpha,
      duration: EDGE_ANIMATION_MS,
    })
  }
  if (topologyChanged) applyEdgeCurves(graph)
  return topologyChanged
}
