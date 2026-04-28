import Graph from "graphology"
import type { GraphEdgeView } from "@simula/shared"

export const EDGE_TYPE = "curvedArrow"
export type ActorGraph = Graph<GraphNodeAttributes, GraphEdgeAttributes>
export type Position = { x: number; y: number }

export interface GraphNodeAttributes {
  label: string
  role: string
  intent: string
  size: number
  color: string
  x: number
  y: number
  interactionCount: number
  zIndex?: number
}

export interface GraphEdgeAttributes {
  type: typeof EDGE_TYPE
  color: string
  size: number
  alpha: number
  visibility: GraphEdgeView["visibility"]
  latestContent: string
  weight: number
  curvature?: number
  parallelIndex?: number | null
  parallelMinIndex?: number | null
  parallelMaxIndex?: number | null
  zIndex?: number
}

export interface LayoutAnimationState {
  frameId?: number
}

export interface EdgeAnimation {
  startedAt: number
  duration: number
  fromSize: number
  toSize: number
  fromAlpha: number
  toAlpha: number
  visibility: GraphEdgeView["visibility"]
}

export interface EdgeAnimationState {
  frameId?: number
  items: Map<string, EdgeAnimation>
}

export interface ActorSignalBadge {
  actorId: string
  symbol: "!" | "?"
  step: string
  expiresAt: number
}

export interface VisibleActorSignalBadge extends ActorSignalBadge {
  position: NodeOverlayPosition
}

export interface NodeOverlayPosition {
  x: number
  y: number
  size: number
}

