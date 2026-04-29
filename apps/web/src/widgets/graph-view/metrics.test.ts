import { describe, expect, test } from "bun:test"
import type { GraphEdgeView, GraphNodeView } from "@simula/shared"
import { buildNodeDegree } from "./metrics"

describe("buildNodeDegree", () => {
  test("counts incident edges without adding repeated interaction weight", () => {
    const nodes: GraphNodeView[] = [
      { id: "a", label: "A", role: "Role A", intent: "", interactionCount: 8 },
      { id: "b", label: "B", role: "Role B", intent: "", interactionCount: 4 },
      { id: "c", label: "C", role: "Role C", intent: "", interactionCount: 1 },
    ]
    const edges: GraphEdgeView[] = [
      edge("a->b:public", "a", "b", "public", 5),
      edge("a->c:private", "a", "c", "private", 1),
    ]

    expect(Object.fromEntries(buildNodeDegree(nodes, edges))).toEqual({
      a: 2,
      b: 1,
      c: 1,
    })
  })
})

function edge(
  id: string,
  source: string,
  target: string,
  visibility: GraphEdgeView["visibility"],
  weight: number
): GraphEdgeView {
  return {
    id,
    source,
    target,
    visibility,
    weight,
    roundIndex: 1,
    latestContent: "",
  }
}
