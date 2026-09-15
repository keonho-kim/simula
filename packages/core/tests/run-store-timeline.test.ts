import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { RunStore } from "@/backend/storage/runs/run-store"
import type { Interaction } from "@/shared"

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

test("artifact paths remain relative to the configured data root after relocating a manifest", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "simula-portable-store-"))
  try {
    const store = new RunStore({ rootDir })
    const { mkdir, writeFile } = await import("node:fs/promises")
    await mkdir(store.runDir("copied-run"), { recursive: true })
    await writeFile(store.path("copied-run", "manifest.json"), JSON.stringify({
      id: "copied-run", status: "created", createdAt: "2026-01-01T00:00:00Z", scenarioName: "sample.md",
      artifactPaths: { report: "runs/copied-run/report.md" },
    }))
    const manifest = await store.readManifest("copied-run")
    expect(manifest.artifactPaths.report).toBe("copied-run/report.md")
    expect(join(store.rootDir, manifest.artifactPaths.report)).toBe(store.path("copied-run", "report.md"))
  } finally {
    await rm(rootDir, { recursive: true, force: true })
  }
})
