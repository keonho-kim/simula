import type { MutableRefObject } from "react"
import Sigma from "sigma"
import { ACTIVE_NODE_TTL_MS } from "./constants"
import { easeOutCubic, interpolate } from "./math"
import { edgeColor } from "./styles"
import type { ActorGraph, EdgeAnimation, EdgeAnimationState, GraphEdgeAttributes, GraphNodeAttributes, LayoutAnimationState, Position } from "./types"

export function animateNodePositions(
  graph: ActorGraph,
  renderer: Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null,
  nodePositions: Map<string, Position>,
  animation: LayoutAnimationState,
  targetPositions: Map<string, Position>,
  duration: number,
  onPositionsChanged?: () => void
): void {
  const startedAt = performance.now()
  const startPositions = readNodePositions(graph)
  const tick = (now: number) => {
    const progress = easeOutCubic(Math.min(1, (now - startedAt) / duration))
    for (const [nodeId, target] of targetPositions) {
      if (!graph.hasNode(nodeId)) {
        continue
      }
      const start = startPositions.get(nodeId) ?? target
      const position = {
        x: interpolate(start.x, target.x, progress),
        y: interpolate(start.y, target.y, progress),
      }
      graph.mergeNodeAttributes(nodeId, position)
      nodePositions.set(nodeId, position)
    }
    renderer?.refresh()
    onPositionsChanged?.()
    if (progress < 1) {
      animation.frameId = window.requestAnimationFrame(tick)
      return
    }
    animation.frameId = undefined
  }
  animation.frameId = window.requestAnimationFrame(tick)
}

export function queueEdgeAnimation(
  graph: ActorGraph,
  renderer: Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null,
  animation: EdgeAnimationState,
  edgeId: string,
  input: Omit<EdgeAnimation, "startedAt">
): void {
  animation.items.set(edgeId, {
    ...input,
    startedAt: performance.now(),
  })
  if (animation.frameId !== undefined) {
    return
  }
  const tick = (now: number) => {
    for (const [id, item] of animation.items) {
      if (!graph.hasEdge(id)) {
        animation.items.delete(id)
        continue
      }
      const progress = easeOutCubic(Math.min(1, (now - item.startedAt) / item.duration))
      const alpha = interpolate(item.fromAlpha, item.toAlpha, progress)
      graph.mergeEdgeAttributes(id, {
        size: interpolate(item.fromSize, item.toSize, progress),
        alpha,
        color: edgeColor(item.visibility, alpha),
      })
      if (progress >= 1) {
        animation.items.delete(id)
      }
    }
    renderer?.refresh()
    animation.frameId = animation.items.size ? window.requestAnimationFrame(tick) : undefined
  }
  animation.frameId = window.requestAnimationFrame(tick)
}

export function updateActiveNodes(
  actorIds: string[],
  activeUntil: Map<string, number>,
  activeNodeIdsRef: MutableRefObject<Set<string>>,
  renderer: Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null,
  frameRef: MutableRefObject<number | undefined>
): void {
  const now = performance.now()
  for (const actorId of actorIds) {
    activeUntil.set(actorId, now + ACTIVE_NODE_TTL_MS)
  }
  refreshActiveNodes(activeUntil, activeNodeIdsRef, renderer)
  if (frameRef.current !== undefined || !activeUntil.size) {
    return
  }
  const tick = () => {
    refreshActiveNodes(activeUntil, activeNodeIdsRef, renderer)
    frameRef.current = activeUntil.size ? window.requestAnimationFrame(tick) : undefined
  }
  frameRef.current = window.requestAnimationFrame(tick)
}

export function readNodePositions(graph: ActorGraph): Map<string, Position> {
  const positions = new Map<string, Position>()
  graph.forEachNode((nodeId, attributes) => {
    positions.set(nodeId, { x: attributes.x, y: attributes.y })
  })
  return positions
}

export function applyNodePositions(graph: ActorGraph, positions: Map<string, Position>): void {
  for (const [nodeId, position] of positions) {
    if (graph.hasNode(nodeId)) {
      graph.mergeNodeAttributes(nodeId, position)
    }
  }
}

export function cancelAnimation(animation: LayoutAnimationState): void {
  if (animation.frameId !== undefined) {
    window.cancelAnimationFrame(animation.frameId)
    animation.frameId = undefined
  }
}

export function cancelEdgeAnimation(animation: EdgeAnimationState): void {
  if (animation.frameId !== undefined) {
    window.cancelAnimationFrame(animation.frameId)
    animation.frameId = undefined
  }
  animation.items.clear()
}

function refreshActiveNodes(
  activeUntil: Map<string, number>,
  activeNodeIdsRef: MutableRefObject<Set<string>>,
  renderer: Sigma<GraphNodeAttributes, GraphEdgeAttributes> | null
): void {
  const now = performance.now()
  const active = new Set<string>()
  for (const [actorId, until] of activeUntil) {
    if (until > now) {
      active.add(actorId)
    } else {
      activeUntil.delete(actorId)
    }
  }
  activeNodeIdsRef.current = active
  renderer?.refresh()
}

