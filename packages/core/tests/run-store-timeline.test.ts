import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { RunStore } from "../src/storage/run-store"
import type { Interaction } from "@simula/shared"

describe("run store graph timeline", () => {
  test("creates live graph frames for actors and each recorded interaction", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "simula-store-timeline-"))
    try {
      const store = new RunStore({ rootDir })
      const run = await store.createRun({
        sourceName: "sample.md",
        text: "A team debates a launch.",
        controls: { numCast: 2, allowAdditionalCast: false, actionsPerType: 3, maxRound: 1, fastMode: false },
      })

      const actorsFrame = await store.appendEvent({
        type: "actors.ready",
        runId: run.id,
        timestamp: "2026-05-14T00:00:00.000Z",
        actors: [
          { id: "actor-1", label: "Actor 1", role: "Lead", intent: "Start", interactionCount: 0 },
          { id: "actor-2", label: "Actor 2", role: "Reviewer", intent: "React", interactionCount: 0 },
        ],
      })

      const interactionFrame = await store.appendEvent({
        type: "interaction.recorded",
        runId: run.id,
        timestamp: "2026-05-14T00:00:01.000Z",
        interaction: interaction("interaction-1", 1, "actor-1", ["actor-2"], "briefing"),
      })
      const repeatedInteractionFrame = await store.appendEvent({
        type: "interaction.recorded",
        runId: run.id,
        timestamp: "2026-05-14T00:00:02.000Z",
        interaction: interaction("interaction-2", 1, "actor-1", ["actor-2"], "warning"),
      })

      expect(actorsFrame?.index).toBe(0)
      expect(actorsFrame?.nodes.map((node) => node.id)).toEqual(["actor-1", "actor-2"])
      expect(actorsFrame?.edges).toEqual([])

      expect(interactionFrame?.index).toBe(1)
      expect(interactionFrame?.edges).toHaveLength(1)
      expect(interactionFrame?.edges[0]).toMatchObject({
        id: "actor-1->actor-2",
        weight: 1,
        latestActionType: "briefing",
      })
      expect(interactionFrame?.nodes.find((node) => node.id === "actor-1")?.interactionCount).toBe(1)
      expect(interactionFrame?.nodes.find((node) => node.id === "actor-2")?.interactionCount).toBe(1)
      expect(interactionFrame?.activeNodeIds).toEqual(["actor-1", "actor-2"])

      expect(repeatedInteractionFrame?.index).toBe(2)
      expect(repeatedInteractionFrame?.edges[0]).toMatchObject({
        id: "actor-1->actor-2",
        weight: 2,
        actionTypes: { briefing: 1, warning: 1 },
        latestActionType: "warning",
      })
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})

function interaction(
  id: string,
  roundIndex: number,
  sourceActorId: string,
  targetActorIds: string[],
  actionType: string
): Interaction {
  return {
    id,
    roundIndex,
    sourceActorId,
    targetActorIds,
    actionType,
    content: `${sourceActorId} acts on ${targetActorIds.join(", ")}.`,
    eventId: "event-1",
    visibility: "public",
    decisionType: "action",
    intent: "Move the situation.",
    expectation: "Targets respond.",
  }
}
