import type { MutableRefObject } from "react"
import Sigma from "sigma"
import forceAtlas2 from "graphology-layout-forceatlas2"
import type { GraphTimelineFrame } from "@simula/shared"
import { EDGE_ANIMATION_MS, LAYOUT_ANIMATION_MS } from "./constants"
import {
  animateNodePositions,
  applyNodePositions,
  cancelAnimation,
  cancelEdgeAnimation,
  queueEdgeAnimation,
  readNodePositions,
} from "./animation"
import {
  actorColor,
  applyEdgeCurves,
  edgeAlpha,
  edgeColor,
  edgeSize,
  forceAtlasOptions,
  initialPosition,
  nodeSize,
} from "./styles"
import { EDGE_TYPE, type ActorGraph, type EdgeAnimationState, type GraphEdgeAttributes, type GraphNodeAttributes, type LayoutAnimationState, type Position } from "./types"

export function writeGraphFrame(
  graph: ActorGraph,
  frame: GraphTimelineFrame | undefined,
  nodePositions: Map<string, Position>,
  frameIndexRef: MutableRefObject<number | undefined>,
  layoutRoundRef: MutableRefObject<number | undefined>,
  layoutAnimation: LayoutAnimationState,
  edgeAnimation: EdgeAnimationState,
  renderer: Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null,
  onPositionsChanged?: () => void
): void {
  if (!frame) {
    cancelAnimation(layoutAnimation)
    cancelEdgeAnimation(edgeAnimation)
    graph.clear()
    nodePositions.clear()
    frameIndexRef.current = undefined
    layoutRoundRef.current = undefined
    return
  }
  if (frame.index === 0 || (frameIndexRef.current !== undefined && frame.index < frameIndexRef.current)) {
    cancelAnimation(layoutAnimation)
    cancelEdgeAnimation(edgeAnimation)
    graph.clear()
    nodePositions.clear()
    frameIndexRef.current = undefined
    layoutRoundRef.current = undefined
  }
  frameIndexRef.current = frame.index

  const nodes = frame?.nodes ?? []
  const nextNodeIds = new Set(nodes.map((node) => node.id))
  for (const nodeId of graph.nodes()) {
    if (!nextNodeIds.has(nodeId)) {
      graph.dropNode(nodeId)
      nodePositions.delete(nodeId)
    }
  }

  nodes.forEach((node, index) => {
    const position = nodePositions.get(node.id) ?? initialPosition(index, nodes.length)
    const attributes: GraphNodeAttributes = {
      label: node.label,
      role: node.role,
      intent: node.intent,
      interactionCount: node.interactionCount,
      size: nodeSize(node),
      color: actorColor(node.id),
      x: position.x,
      y: position.y,
    }
    nodePositions.set(node.id, position)
    if (graph.hasNode(node.id)) {
      graph.mergeNodeAttributes(node.id, {
        label: attributes.label,
        role: attributes.role,
        intent: attributes.intent,
        interactionCount: attributes.interactionCount,
        size: attributes.size,
        color: attributes.color,
      })
    } else {
      graph.addNode(node.id, attributes)
    }
  })

  const nextEdgeIds = new Set((frame?.edges ?? []).map((edge) => edge.id))
  for (const edgeId of graph.edges()) {
    if (!nextEdgeIds.has(edgeId)) {
      graph.dropEdge(edgeId)
      edgeAnimation.items.delete(edgeId)
    }
  }
  for (const edge of frame?.edges ?? []) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) {
      continue
    }
    const targetSize = edgeSize(edge)
    const targetAlpha = edgeAlpha(edge.visibility)
    if (graph.hasEdge(edge.id)) {
      const current = graph.getEdgeAttributes(edge.id)
      graph.mergeEdgeAttributes(edge.id, {
        type: EDGE_TYPE,
        visibility: edge.visibility,
        latestContent: edge.latestContent,
        weight: edge.weight,
      })
      if (current.weight !== edge.weight || current.visibility !== edge.visibility) {
        queueEdgeAnimation(graph, renderer, edgeAnimation, edge.id, {
          visibility: edge.visibility,
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
      color: edgeColor(edge.visibility, 0.08),
      size: 0.2,
      alpha: 0.08,
      visibility: edge.visibility,
      latestContent: edge.latestContent,
      weight: edge.weight,
    }
    graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, attributes)
    queueEdgeAnimation(graph, renderer, edgeAnimation, edge.id, {
      visibility: edge.visibility,
      fromSize: attributes.size,
      toSize: targetSize,
      fromAlpha: attributes.alpha,
      toAlpha: targetAlpha,
      duration: EDGE_ANIMATION_MS,
    })
  }
  applyEdgeCurves(graph)

  if (
    frame.layoutRoundIndex !== undefined &&
    layoutRoundRef.current !== frame.layoutRoundIndex &&
    graph.order > 1
  ) {
    cancelAnimation(layoutAnimation)
    const startPositions = readNodePositions(graph)
    forceAtlas2.assign(graph, forceAtlasOptions(graph.order))
    const targetPositions = readNodePositions(graph)
    applyNodePositions(graph, startPositions)
    layoutRoundRef.current = frame.layoutRoundIndex
    animateNodePositions(graph, renderer, nodePositions, layoutAnimation, targetPositions, LAYOUT_ANIMATION_MS, onPositionsChanged)
  }
}

