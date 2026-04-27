import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  RunStore,
  applyInteractionContext,
  applyPreRoundDigestContext,
  defaultSettings,
  emptyActorContext,
  runSimulation,
} from "../src"
import type { ActorState, Interaction, RunEvent } from "@simula/shared"

describe("simulation workflow", () => {
  test("emits lifecycle events and returns a report", async () => {
    const settings = defaultSettings()
    for (const role of Object.keys(settings) as Array<keyof typeof settings>) {
      settings[role].apiKey = "test-key"
    }
    const events: RunEvent[] = []
    const state = await runSimulation({
      runId: "test-run",
      settings,
      scenario: {
        sourceName: "test.md",
        text: "A city council faces a flood response conflict.",
        controls: { numCast: 3, allowAdditionalCast: true, actionsPerType: 3, fastMode: false },
      },
      emit: async (event) => {
        events.push(event)
      },
    })

    expect(events.some((event) => event.type === "node.started" && event.nodeId === "planner")).toBe(true)
    expect(events.some((event) => event.type === "node.started" && event.nodeId === "generator")).toBe(true)
    expect(events.some((event) => event.type === "node.completed" && event.nodeId === "finalization")).toBe(true)
    expect(state.actors).toHaveLength(3)
    expect(state.actors.every((actor) => actor.actions.length === 12)).toBe(true)
    expect(state.actors.every((actor) => new Set(actor.actions.map((action) => action.id)).size === 12)).toBe(true)
    expect(
      state.actors.every((actor) =>
        ["public", "semi-public", "private", "solitary"].every(
          (visibility) => actor.actions.filter((action) => action.visibility === visibility).length === 3
        )
      )
    ).toBe(true)
    expect(state.actors.every((actor) => actor.context.public.length > 0)).toBe(true)
    expect(Object.keys(state.actors[0]?.context.semiPublic ?? {})).toHaveLength(0)
    expect(Object.keys(state.actors[1]?.context.semiPublic ?? {}).length).toBeGreaterThan(0)
    expect(Object.keys(state.actors[2]?.context.private ?? {}).length).toBeGreaterThan(0)
    expect(state.roundDigests).toHaveLength(3)
    expect(state.roundReports).toHaveLength(3)
    expect(state.roundReports.map((report) => report.roundIndex)).toEqual([1, 2, 3])
    expect(state.roundDigests.every((digest) => digest.preRound.content)).toBe(true)
    expect(state.roundDigests.every((digest) => digest.afterRound.content)).toBe(true)
    expect(state.actors.every((actor) => actor.context.public.some((entry) => entry.includes("pre-round")))).toBe(true)
    expect(
      state.actors.every((actor) =>
        !actor.memory.some((entry) => entry.includes("After-round") || entry.includes("produced a"))
      )
    ).toBe(true)
    expect(state.roleTraces).toHaveLength(4)
    expect(state.roleTraces.every((trace) => trace.thought && trace.target && trace.action && trace.intent)).toBe(true)
    expect(state.roleTraces.map((trace) => trace.role)).toContain("generator")
    expect(state.plan?.backgroundStory).toBeTruthy()
    expect(state.plan?.actionCatalog.length).toBeGreaterThan(0)
    expect(state.reportMarkdown).toContain("# Simula Report")
    expect(state.reportMarkdown).toContain("## Background Story")
    expect(state.reportMarkdown).toContain("## Round Digests")
    expect(state.reportMarkdown).toContain("## Round Reports")
    expect(state.reportMarkdown).toContain("## Role Traces")
    expect(events.filter((event) => event.type === "report.delta")).toHaveLength(4)
  })

  test("fails after five empty model responses and logs retry attempts", async () => {
    const settings = defaultSettings()
    for (const role of Object.keys(settings) as Array<keyof typeof settings>) {
      settings[role].apiKey = role === "planner" ? "empty-test-key" : "test-key"
    }
    const events: RunEvent[] = []

    await expect(
      runSimulation({
        runId: "retry-run",
        settings,
        scenario: {
          sourceName: "retry.md",
          text: "A city council faces a flood response conflict.",
          controls: { numCast: 3, allowAdditionalCast: true, actionsPerType: 3, fastMode: false },
        },
        emit: async (event) => {
          events.push(event)
        },
      })
    ).rejects.toThrow("planner.thought failed after 5 empty responses")

    expect(
      events.filter(
        (event) =>
          event.type === "log" &&
          event.level === "warn" &&
          event.message.includes("planner.thought returned empty text")
      )
    ).toHaveLength(5)
  })

  test("runs with fast mode while preserving actor action counts", async () => {
    const settings = defaultSettings()
    for (const role of Object.keys(settings) as Array<keyof typeof settings>) {
      settings[role].apiKey = "test-key"
    }
    const events: RunEvent[] = []
    const state = await runSimulation({
      runId: "fast-run",
      settings,
      scenario: {
        sourceName: "fast.md",
        text: "A city council faces a flood response conflict.",
        controls: { numCast: 3, allowAdditionalCast: true, actionsPerType: 2, fastMode: true },
      },
      emit: async (event) => {
        events.push(event)
      },
    })

    expect(state.actors).toHaveLength(3)
    expect(state.actors.every((actor) => actor.actions.length === 8)).toBe(true)
    expect(
      events.some(
        (event) =>
          event.type === "log" &&
          event.message === "Fast Mode enabled; dependency-sensitive stages remain sequential."
      )
    ).toBe(true)
  })

  test("keeps no-action context solitary to the source actor", () => {
    const actors = [testActor("actor-1"), testActor("actor-2")]
    const interaction: Interaction = {
      id: "no-action-1",
      roundIndex: 1,
      sourceActorId: "actor-1",
      targetActorIds: [],
      actionType: "no_action",
      content: "Actor 1 held back.",
      eventId: "event-1",
      visibility: "solitary",
      decisionType: "no_action",
      intent: "Wait and watch.",
      expectation: "The situation may clarify.",
    }

    const updated = applyInteractionContext(actors, interaction)

    expect(updated[0]?.context.solitary).toHaveLength(1)
    expect(updated[1]?.context.solitary).toHaveLength(0)
  })

  test("shares pre-round digest with actors without leaking after-round digest", () => {
    const actors = [testActor("actor-1"), testActor("actor-2")]
    const updated = applyPreRoundDigestContext(actors, {
      roundIndex: 1,
      preRound: {
        elapsedTime: "Opening moment",
        content: "A public pressure is visible.",
      },
      afterRound: {
        content: "This user-facing summary must not be injected.",
      },
    })

    expect(updated.every((actor) => actor.context.public.some((entry) => entry.includes("A public pressure")))).toBe(true)
    expect(updated.every((actor) => actor.memory.some((entry) => entry.includes("A public pressure")))).toBe(true)
    expect(updated.every((actor) => !actor.memory.some((entry) => entry.includes("user-facing summary")))).toBe(true)
  })
})

function testActor(id: string): ActorState {
  return {
    id,
    name: id,
    role: "Test actor",
    privateGoal: "Test goal",
    intent: "Test intent",
    actions: [],
    context: emptyActorContext(),
    memory: [],
    relationships: {},
  }
}

describe("run store", () => {
  test("writes manifest, events, state, report, and export artifacts", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "simula-store-"))
    try {
      const store = new RunStore({ rootDir })
      const run = await store.createRun({
        sourceName: "sample.md",
        text: "A startup board argues over risk.",
        controls: { numCast: 2, allowAdditionalCast: false, actionsPerType: 3, fastMode: false },
      })

      const frame = await store.appendEvent({
        type: "run.started",
        runId: run.id,
        timestamp: new Date().toISOString(),
      })
      expect(frame?.index).toBe(0)

      await store.writeState({
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
