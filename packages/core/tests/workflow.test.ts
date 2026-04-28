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
      settings[role].apiKey = "unit-test-api-key"
    }
    const events: RunEvent[] = []
    const state = await runSimulation({
      runId: "test-run",
      settings,
      scenario: {
        sourceName: "test.md",
        text: "A city council faces a flood response conflict.",
        controls: { numCast: 3, allowAdditionalCast: true, actionsPerType: 3, maxRound: 3, fastMode: false },
      },
      emit: async (event) => {
        events.push(event)
      },
    })

    expect(events.some((event) => event.type === "node.started" && event.nodeId === "planner")).toBe(true)
    expect(events.some((event) => event.type === "node.started" && event.nodeId === "generator")).toBe(true)
    expect(events.some((event) => event.type === "node.completed" && event.nodeId === "finalization")).toBe(true)
    expect(events.some((event) => event.type === "actors.ready" && event.actors.length === 3)).toBe(true)
    expect(events.filter((event) => event.type === "interaction.recorded")).toHaveLength(9)
    expect(events.filter((event) => event.type === "round.completed")).toHaveLength(3)
    const metricEvents = events.filter((event) => event.type === "model.metrics")
    expect(metricEvents.length).toBeGreaterThan(0)
    expect(metricEvents.every((event) => event.type === "model.metrics" && event.metrics.durationMs > 0)).toBe(true)
    expect(metricEvents.every((event) => event.type === "model.metrics" && event.metrics.totalTokens > 0)).toBe(true)
    expect(state.actors).toHaveLength(3)
    expect(new Set(state.actors.map((actor) => actor.name)).size).toBe(state.actors.length)
    expect(state.actorRoster?.map((entry) => entry.name)).toEqual(state.actors.map((actor) => actor.name))
    expect(state.actors.every((actor) => actor.backgroundHistory && actor.personality && actor.preference)).toBe(true)
    expect(state.actors.every((actor) => actor.contextSummary)).toBe(true)
    expect(state.interactions).toHaveLength(9)
    expect(state.interactions.every((interaction) => interaction.content.includes("I will state my position clearly."))).toBe(true)
    expect(events.filter((event) => event.type === "actor.message")).toHaveLength(9)
    expect(
      [1, 2, 3].every((roundIndex) =>
        state.actors.every((actor) =>
          state.interactions.some(
            (interaction) => interaction.roundIndex === roundIndex && interaction.sourceActorId === actor.id
          )
        )
      )
    ).toBe(true)
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
    expect(state.actors.some((actor) => Object.keys(actor.context.semiPublic).length > 0)).toBe(true)
    expect(state.actors.some((actor) => Object.keys(actor.context.private).length > 0)).toBe(true)
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
    expect(state.roleTraces).toHaveLength(3)
    expect(
      state.roleTraces.every((trace) =>
        trace.role === "planner"
          ? trace.coreSituation && trace.actorPressures && trace.conflictDynamics && trace.simulationDirection
            : trace.role === "coordinator"
            ? trace.runtimeFrame && trace.actorRouting && trace.interactionPolicy && trace.outcomeDirection && trace.eventInjection && trace.progressDecision
            : trace.thought && trace.target && trace.action && trace.intent
      )
    ).toBe(true)
    expect(state.roleTraces.map((trace) => trace.role)).not.toContain("generator")
    expect(
      events.filter(
        (event) =>
          event.type === "model.metrics" &&
          event.metrics.role === "generator" &&
          ["roster", "role", "backgroundHistory", "personality", "preference"].includes(event.metrics.step)
      )
    ).toHaveLength(13)
    expect(
      events.filter((event) => event.type === "model.metrics" && event.metrics.role === "actor" && event.metrics.step === "message")
    ).toHaveLength(9)
    expect(
      events.filter((event) => event.type === "model.metrics" && event.metrics.role === "actor" && event.metrics.step === "context")
    ).toHaveLength(9)
    expect(events.findIndex((event) => event.type === "model.message" && event.role === "actor")).toBeLessThan(
      events.findIndex((event) => event.type === "interaction.recorded")
    )
    expect(events.findIndex((event) => event.type === "round.completed" && event.roundIndex === 1)).toBeGreaterThan(
      events.findLastIndex((event) => event.type === "interaction.recorded" && event.interaction.roundIndex === 1)
    )
    expect(state.plan?.backgroundStory).toBeTruthy()
    expect(state.plan?.scenarioDigest?.coreSituation).toBeTruthy()
    expect(state.plan?.scenarioDigest?.actorPressures).toBeTruthy()
    expect(state.plan?.scenarioDigest?.conflictDynamics).toBeTruthy()
    expect(state.plan?.scenarioDigest?.simulationDirection).toBeTruthy()
    expect(state.plan?.backgroundStory).toContain("Core situation:")
    expect(state.plan?.majorEvents.every((event) => event.title.includes("Major Event"))).toBe(true)
    expect(state.plan?.actionCatalog.length).toBeGreaterThan(0)
    expect(state.reportMarkdown).toContain("# Simula Report")
    expect(state.reportMarkdown).toContain("## Scenario Digest")
    expect(state.reportMarkdown).toContain("## Actor Cards")
    expect(state.reportMarkdown).toContain("## Round Digests")
    expect(state.reportMarkdown).toContain("## Round Reports")
    expect(state.reportMarkdown).toContain("## Role Traces")
    expect(events.filter((event) => event.type === "report.delta")).toHaveLength(4)
  })

  test("fails after five empty model responses and logs retry attempts", async () => {
    const settings = defaultSettings()
    for (const role of Object.keys(settings) as Array<keyof typeof settings>) {
      settings[role].apiKey = role === "planner" ? "unit-test-empty-key" : "unit-test-api-key"
    }
    const events: RunEvent[] = []

    await expect(
      runSimulation({
        runId: "retry-run",
        settings,
        scenario: {
          sourceName: "retry.md",
          text: "A city council faces a flood response conflict.",
          controls: { numCast: 3, allowAdditionalCast: true, actionsPerType: 3, maxRound: 3, fastMode: false },
        },
        emit: async (event) => {
          events.push(event)
        },
      })
    ).rejects.toThrow("planner.coreSituation failed after 5 empty responses")

    expect(
      events.filter(
        (event) =>
          event.type === "log" &&
          event.level === "warn" &&
          event.message.includes("planner.coreSituation returned empty text")
      )
    ).toHaveLength(5)
    expect(
      events.filter(
        (event) =>
          event.type === "model.metrics" &&
          event.metrics.role === "planner" &&
          event.metrics.step === "coreSituation"
      )
    ).toHaveLength(5)
  })

  test("runs with fast mode while preserving actor action counts", async () => {
    const settings = defaultSettings()
    for (const role of Object.keys(settings) as Array<keyof typeof settings>) {
      settings[role].apiKey = "unit-test-api-key"
    }
    const events: RunEvent[] = []
    const state = await runSimulation({
      runId: "fast-run",
      settings,
      scenario: {
        sourceName: "fast.md",
        text: "A city council faces a flood response conflict.",
        controls: { numCast: 3, allowAdditionalCast: true, actionsPerType: 2, maxRound: 3, fastMode: true },
      },
      emit: async (event) => {
        events.push(event)
      },
    })

    expect(state.actors).toHaveLength(3)
    expect(state.actors.every((actor) => actor.backgroundHistory && actor.personality && actor.preference)).toBe(true)
    expect(state.actors.every((actor) => actor.actions.length === 8)).toBe(true)
    expect(state.interactions).toHaveLength(9)
    expect(state.roundReports.map((report) => report.roundIndex)).toEqual([1, 2, 3])
    expect(events.filter((event) => event.type === "report.delta")).toHaveLength(4)
    expect(
      events.some(
        (event) =>
          event.type === "log" &&
          event.message ===
            "Fast Mode enabled; actor decisions and observer round reports run in parallel while dependency-sensitive stages remain sequential."
      )
    ).toBe(true)
  })

  test("uses max round as the actor activity round count", async () => {
    const settings = defaultSettings()
    for (const role of Object.keys(settings) as Array<keyof typeof settings>) {
      settings[role].apiKey = "unit-test-api-key"
    }
    const state = await runSimulation({
      runId: "round-run",
      settings,
      scenario: {
        sourceName: "round.md",
        text: "A team faces a release decision.",
        controls: { numCast: 2, allowAdditionalCast: true, actionsPerType: 2, maxRound: 4, fastMode: false },
      },
      emit: async () => {},
    })

    expect(state.roundDigests).toHaveLength(4)
    expect(state.interactions).toHaveLength(8)
    expect(state.roundDigests.map((digest) => digest.roundIndex)).toEqual([1, 2, 3, 4])
  })

  test("extends max round by five when coordinator returns continue at the boundary", async () => {
    const settings = defaultSettings()
    for (const role of Object.keys(settings) as Array<keyof typeof settings>) {
      settings[role].apiKey = "unit-test-api-key"
    }
    const state = await runSimulation({
      runId: "extend-run",
      settings,
      scenario: {
        sourceName: "extend.md",
        text: "continue-extension: a team needs one more phase.",
        controls: { numCast: 2, allowAdditionalCast: true, actionsPerType: 2, maxRound: 1, fastMode: false },
      },
      emit: async () => {},
    })

    expect(state.roundDigests).toHaveLength(6)
    expect(state.interactions).toHaveLength(12)
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
    backgroundHistory: "Test history",
    personality: "Test personality",
    preference: "Test preference",
    privateGoal: "Test goal",
    intent: "Test intent",
    actions: [],
    context: emptyActorContext(),
    memory: [],
    relationships: {},
    contextSummary: "",
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
        controls: { numCast: 2, allowAdditionalCast: false, actionsPerType: 3, maxRound: 8, fastMode: false },
      })

      const frame = await store.appendEvent({
        type: "run.started",
        runId: run.id,
        timestamp: new Date().toISOString(),
      })
      expect(frame).toBeUndefined()

      const actorsFrame = await store.appendEvent({
        type: "actors.ready",
        runId: run.id,
        timestamp: new Date().toISOString(),
        actors: [
          { id: "actor-1", label: "Actor 1", role: "Leader", intent: "Move first.", interactionCount: 0 },
          { id: "actor-2", label: "Actor 2", role: "Reviewer", intent: "Respond.", interactionCount: 0 },
        ],
      })
      expect(actorsFrame?.nodes).toHaveLength(2)

      const interactionFrame = await store.appendEvent({
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
      expect(interactionFrame?.edges).toHaveLength(1)
      expect(interactionFrame?.edges[0]?.weight).toBe(1)
      expect(interactionFrame?.nodes.find((node) => node.id === "actor-1")?.interactionCount).toBe(1)
      expect(interactionFrame?.nodes.find((node) => node.id === "actor-2")?.interactionCount).toBe(1)

      const messageFrame = await store.appendEvent({
        type: "actor.message",
        runId: run.id,
        timestamp: new Date().toISOString(),
        actorId: "actor-1",
        actorName: "Actor 1",
        content: "I have finished my step.",
      })
      expect(messageFrame).toBeUndefined()

      const roundFrame = await store.appendEvent({
        type: "round.completed",
        runId: run.id,
        timestamp: new Date().toISOString(),
        roundIndex: 1,
      })
      expect(roundFrame?.layoutRoundIndex).toBe(1)
      expect(roundFrame?.edges).toHaveLength(1)
      expect(roundFrame?.activeNodeIds).toEqual([])

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
