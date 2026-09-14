import { easeOutCubic, interpolate } from "@/ui/components/graph/math"
import { edgeColor } from "@/ui/components/graph/styles"
import type { ActorGraph, EdgeAnimation, EdgeAnimationState, LayoutAnimationState, Position } from "@/ui/components/graph/types"

export function animateNodePositions(
  graph: ActorGraph,
  nodePositions: Map<string, Position>,
  animation: LayoutAnimationState,
  targetPositions: Map<string, Position>,
  duration: number
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
        color: edgeColor(item.weight, alpha),
      })
      if (progress >= 1) {
        animation.items.delete(id)
      }
    }
    animation.frameId = animation.items.size ? window.requestAnimationFrame(tick) : undefined
  }
  animation.frameId = window.requestAnimationFrame(tick)
}

function readNodePositions(graph: ActorGraph): Map<string, Position> {
  const positions = new Map<string, Position>()
  graph.forEachNode((nodeId, attributes) => {
    positions.set(nodeId, { x: attributes.x, y: attributes.y })
  })
  return positions
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
