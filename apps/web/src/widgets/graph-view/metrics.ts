import type { GraphEdgeView, GraphNodeView } from "@simula/shared"

export function buildNodeDegree(nodes: GraphNodeView[], edges: GraphEdgeView[]): Map<string, number> {
  const degree = new Map(nodes.map((node) => [node.id, 0]))
  for (const edge of edges) {
    if (!degree.has(edge.source) || !degree.has(edge.target)) {
      continue
    }
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
    if (edge.target !== edge.source) {
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
    }
  }
  return degree
}
