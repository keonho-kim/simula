export interface ReportCommentaryNode {
  id: string
  level: number
  children: string[]
  status: "ready" | "failed"
  summary?: string
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
