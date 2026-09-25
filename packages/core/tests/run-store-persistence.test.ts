/**
 * Purpose: Verify RunStore persistence, timeline, state, and export artifacts.
 * Pattern: Repository contract test.
 * Usage: Executed by bun test with an isolated temporary directory.
 * Related: src/backend/storage/runs/run-store.ts
 */
import { seedRunEvent, seedRunState } from "@/backend/storage/runs/testing/fixtures"
import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { RunStore } from "@/backend/storage/runs/run-store"

describe("run store", () => {
  test("writes manifest, events, state, report, and export artifacts", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "simula-store-"))
    try {
      const store = new RunStore({ rootDir })
      const run = await store.createRun({
        sourceName: "sample.md",
        text: "A startup board argues over risk.",
        controls: { numCast: 2, allowAdditionalCast: false, actionsPerType: 3, maxRound: 8, fastMode: false },
      })

      const frame = await seedRunEvent(store, {
        type: "run.started",
        runId: run.id,
        timestamp: new Date().toISOString(),
      })
      expect(frame).toBeUndefined()

      const actorsFrame = await seedRunEvent(store, {
        type: "actors.ready",
        runId: run.id,
        timestamp: new Date().toISOString(),
        actors: [
          { id: "actor-1", label: "Actor 1", role: "Leader", intent: "Move first.", interactionCount: 0 },
          { id: "actor-2", label: "Actor 2", role: "Reviewer", intent: "Respond.", interactionCount: 0 },
        ],
      })
      expect(actorsFrame?.layoutRoundIndex).toBeUndefined()
      expect(actorsFrame?.nodes.map((node) => node.id)).toEqual(["actor-1", "actor-2"])
      expect(actorsFrame?.edges).toEqual([])
      expect(actorsFrame?.activeNodeIds).toEqual(["actor-1", "actor-2"])

      const interactionFrame = await seedRunEvent(store, {
        type: "interaction.recorded",
        runId: run.id,
        timestamp: new Date().toISOString(),
        interaction: {
          id: "interaction-1",
          roundIndex: 1,
          sourceActorId: "actor-1",
          targetActorIds: ["actor-2"],
          actionType: "public-action",
          content: "Actor 1 pushed the discussion to Actor 2.",
          eventId: "event-1",
          visibility: "public",
          decisionType: "action",
          intent: "Create pressure.",
          expectation: "Actor 2 responds.",
        },
      })
      expect(interactionFrame?.layoutRoundIndex).toBeUndefined()
      expect(interactionFrame?.index).toBe(1)
      expect(interactionFrame?.edges).toHaveLength(1)
      expect(interactionFrame?.edges[0]?.weight).toBe(1)
      expect(interactionFrame?.activeNodeIds).toEqual(["actor-1", "actor-2"])

      const messageFrame = await seedRunEvent(store, {
        type: "actor.message",
        runId: run.id,
        timestamp: new Date().toISOString(),
        actorId: "actor-1",
        actorName: "Actor 1",
        content: "I have finished my step.",
      })
      expect(messageFrame).toBeUndefined()

      const roundFrame = await seedRunEvent(store, {
        type: "round.completed",
        runId: run.id,
        timestamp: new Date().toISOString(),
        roundIndex: 1,
      })
      expect(roundFrame?.layoutRoundIndex).toBe(1)
      expect(roundFrame?.index).toBe(2)
      expect(roundFrame?.edges).toHaveLength(1)
      expect(roundFrame?.edges[0]?.weight).toBe(1)
      expect(roundFrame?.nodes.find((node) => node.id === "actor-1")?.interactionCount).toBe(1)
      expect(roundFrame?.nodes.find((node) => node.id === "actor-2")?.interactionCount).toBe(1)
      expect(roundFrame?.activeNodeIds).toEqual(["actor-1", "actor-2"])

      await seedRunState(store, {
        runId: run.id,
        scenario: await store.readScenario(run.id),
        actors: [],
        interactions: [],
        roundDigests: [],
        roundReports: [],
        roleTraces: [],
        worldSummary: "Done.",
        reportMarkdown: "# Report",
        stopReason: "simulation_done",
        errors: [],
      })

      expect((await store.export(run.id, "json")).body).toContain("Done.")
      expect((await store.export(run.id, "jsonl")).body).toContain("run.started")
      expect((await store.export(run.id, "md")).body).toContain("# Report")
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})
