import { describe, expect, test } from "bun:test"
import type { GraphEdgeView, Interaction, RunEvent } from "@simula/shared"
import { buildEdgeInteractionHistory, interactionMatchesEdge } from "./edge-history"

const runId = "run-edge-history"
const timestamp = "2026-04-29T00:00:00.000Z"

describe("edge interaction history", () => {
  test("matches interactions by source, target, and visibility", () => {
    const selectedEdge = edge("a", "b", "public")
    expect(interactionMatchesEdge(interaction("i1", "a", ["b"], "public"), selectedEdge)).toBe(true)
    expect(interactionMatchesEdge(interaction("i2", "a", ["b"], "private"), selectedEdge)).toBe(false)
    expect(interactionMatchesEdge(interaction("i3", "b", ["a"], "public"), selectedEdge)).toBe(false)
  })

  test("dedupes live and state interactions and keeps multi-target matches", () => {
    const selectedEdge = edge("a", "c", "semi-public")
    const first = interaction("i1", "a", ["b", "c"], "semi-public", 1)
    const second = interaction("i2", "a", ["c"], "semi-public", 2)
    const events: RunEvent[] = [
      {
        type: "interaction.recorded",
        runId,
        timestamp,
        interaction: first,
      },
    ]

    const history = buildEdgeInteractionHistory(selectedEdge, events, [first, second])

    expect(history.map((item) => item.id)).toEqual(["i2", "i1"])
  })
})

function edge(source: string, target: string, visibility: GraphEdgeView["visibility"]): GraphEdgeView {
  return {
    id: `${source}->${target}:${visibility}`,
    source,
    target,
    visibility,
    weight: 1,
    roundIndex: 1,
    latestContent: "",
  }
}

function interaction(
  id: string,
  sourceActorId: string,
  targetActorIds: string[],
  visibility: Interaction["visibility"],
  roundIndex = 1
): Interaction {
  return {
    id,
    roundIndex,
    sourceActorId,
    targetActorIds,
    actionType: "briefing",
    content: `${id} content`,
    eventId: "event-1",
    visibility,
    decisionType: "action",
    intent: "Move the situation.",
    expectation: "The target responds.",
  }
}
