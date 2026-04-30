import type { ActionVisibility } from "./simulation"

export interface GraphNodeView {
  id: string
  label: string
  role: string
  intent: string
  interactionCount: number
}

export interface ActorReadyView extends GraphNodeView {
  backgroundHistory?: string
  personality?: string
  preference?: string
  privateGoal?: string
  contextSummary?: string
}

export interface GraphEdgeView {
  id: string
  source: string
  target: string
  visibility: ActionVisibility
  weight: number
  roundIndex: number
  latestContent: string
}

export interface GraphTimelineFrame {
  index: number
  timestamp: string
  nodes: GraphNodeView[]
  edges: GraphEdgeView[]
  activeNodeIds: string[]
  messages: string[]
  logRefs: string[]
  layoutRoundIndex?: number
}
