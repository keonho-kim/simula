import type { CSSProperties } from "react"
import Sigma from "sigma"
import { ACTOR_POPOVER_WIDTH } from "./constants"
import { clamp } from "./math"
import type { ActorGraph, GraphEdgeAttributes, GraphNodeAttributes, NodeOverlayPosition } from "./types"

export function nodeOverlayPosition(
  renderer: Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null,
  graph: ActorGraph | null,
  nodeId: string
): NodeOverlayPosition | undefined {
  if (!renderer || !graph || !graph.hasNode(nodeId)) {
    return undefined
  }
  const attributes = graph.getNodeAttributes(nodeId)
  const viewport = renderer.graphToViewport({ x: attributes.x, y: attributes.y })
  return { ...viewport, size: attributes.size }
}

export function actorPopoverStyle(
  renderer: Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null,
  position: NodeOverlayPosition
): CSSProperties | undefined {
  if (!renderer) {
    return undefined
  }
  const dimensions = renderer.getDimensions()
  const width = Math.min(ACTOR_POPOVER_WIDTH, Math.max(220, dimensions.width - 24))
  return {
    left: clamp(position.x - width / 2, 12, Math.max(12, dimensions.width - width - 12)),
    top: position.y + position.size + 18,
    width,
  }
}

