import { easeOutCubic, interpolate } from "@/ui/components/graph/math"
import type { ActorGraph, LayoutAnimationState, Position } from "@/ui/components/graph/types"

export function animateNodePositions(
  graph: ActorGraph,
  nodePositions: Map<string, Position>,
  animation: LayoutAnimationState,
  targetPositions: Map<string, Position>,
  duration: number
): void {
  const startedAt = performance.now()
  const startPositions = readNodePositions(graph)
  let moving = false
  for (const [nodeId, target] of targetPositions) {
    const start = startPositions.get(nodeId)
    if (start && (start.x !== target.x || start.y !== target.y)) moving = true
    if (start) nodePositions.set(nodeId, start)
  }
  if (!moving) return
  if (globalThis.document?.hidden) duration = 0
  const tick = (now: number) => {
    const progress = duration <= 0 ? 1 : easeOutCubic(Math.min(1, (now - startedAt) / duration))
    graph.updateEachNodeAttributes((nodeId, attributes) => {
      const target = targetPositions.get(nodeId)
      if (!target) return attributes
      const start = startPositions.get(nodeId) ?? target
      const position = { x: interpolate(start.x, target.x, progress), y: interpolate(start.y, target.y, progress) }
      nodePositions.set(nodeId, position)
      return { ...attributes, ...position }
    }, { attributes: ["x", "y"] })
    if (progress < 1) {
      animation.frameId = window.requestAnimationFrame(tick)
      return
    }
    animation.frameId = undefined
  }
  if (duration <= 0) tick(startedAt)
  else animation.frameId = window.requestAnimationFrame(tick)
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
