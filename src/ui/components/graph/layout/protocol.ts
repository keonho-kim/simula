import type { Position } from "../types"

export interface LayoutInput {
  nodes: Array<Position & { id: string; size: number }>
  edges: Array<{ id: string; source: string; target: string; weight: number }>
}
export type LayoutOutput = Array<[string, Position]>
