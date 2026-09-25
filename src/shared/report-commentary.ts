/**
 * Purpose: Define serializable report commentary nodes and their accepted fields.
 * Pattern: Shared contract.
 * Usage: Shared by simulation finalization, storage, and report rendering.
 * Related: src/backend/core/simulation/outputs/commentary/node.ts
 */
export interface ReportCommentaryNode {
  id: string
  level: number
  children: string[]
  status: "ready" | "failed"
  summary?: string
  findingCount?: number
  findings?: string[]
  conclusion?: string
  evidenceIds: string[]
  issue?: string
}
export interface ReportCommentary {
  status: "running" | "ready" | "partial" | "failed"
  nodes: ReportCommentaryNode[]
  rootId?: string
}
