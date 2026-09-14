import Graph from "graphology"
import forceAtlas2 from "graphology-layout-forceatlas2"
import { forceAtlasOptions } from "./options"
import type { LayoutInput, LayoutOutput } from "./protocol"

export function calculateLayout(input: LayoutInput): LayoutOutput {
  const graph = new Graph({ type: "directed", multi: true })
  for (const { id, ...position } of input.nodes) graph.addNode(id, position)
  for (const edge of input.edges) graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, { weight: edge.weight })
  return Object.entries(forceAtlas2(graph, forceAtlasOptions(graph.order)))
}
