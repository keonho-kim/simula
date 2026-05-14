import { describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  RunStore,
  applyInjectedEventContext,
  applyInteractionContext,
  actorPromptContext,
  emptyActorContext,
} from "../src"
import { buildTimelineFrame } from "../src/simulation/timeline"
import type { ActorState, Interaction, RunEvent } from "@simula/shared"

describe("simulation workflow", () => {
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

    expect(updated[0]?.context.visible).toHaveLength(1)
    expect(updated[0]?.context.visible[0]?.kind).toBe("self")
    expect(updated[1]?.context.visible).toHaveLength(0)
  })

  test("does not feed no-action entries as own recent actions", () => {
    const actors = [testActor("actor-1"), testActor("actor-2")]
    const updated = applyInteractionContext(actors, {
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
    })

    const promptContext = actorPromptContext(updated[0] as ActorState)

    expect(promptContext).toContain("Own recent actions:\n- None")
    expect(promptContext).not.toContain("Actor 1 held back.")
  })

  test("shares injected events with actors as visible event context", () => {
    const actors = [testActor("actor-1"), testActor("actor-2")]
    const updated = applyInjectedEventContext(actors, {
      id: "round-1-event-1",
      roundIndex: 1,
      sourceEventId: "event-1",
      title: "Public pressure",
      summary: "A public pressure is visible.",
    })

    expect(updated.every((actor) => actor.context.visible.some((entry) => entry.kind === "event" && entry.content.includes("A public pressure")))).toBe(true)
    expect(updated.every((actor) => actor.memory.some((entry) => entry.includes("A public pressure")))).toBe(true)
  })

  test("does not count no-action or self-target interactions in graph timeline", () => {
    const firstFrame = buildTimelineFrame(0, actorsReadyEvent())
    const noActionFrame = buildTimelineFrame(1, interactionEvent({
      id: "no-action-1",
      roundIndex: 1,
      sourceActorId: "actor-1",
      targetActorIds: [],
      actionType: "no_action",
      content: "Actor 1 held back.",
      eventId: "event-1",
      visibility: "solitary",
      decisionType: "no_action",
      intent: "Wait.",
      expectation: "Nothing changes.",
    }), firstFrame)

    expect(noActionFrame.nodes.find((node) => node.id === "actor-1")?.interactionCount).toBe(0)
    expect(noActionFrame.edges).toEqual([])
    expect(noActionFrame.activeNodeIds).toEqual([])

    const selfTargetFrame = buildTimelineFrame(2, interactionEvent({
      id: "self-target-1",
      roundIndex: 2,
      sourceActorId: "actor-1",
      targetActorIds: ["actor-1"],
      actionType: "public-action",
      content: "Actor 1 loops back to self.",
      eventId: "event-1",
      visibility: "public",
      decisionType: "action",
      intent: "Act alone.",
      expectation: "No relation changes.",
    }), noActionFrame)

    expect(selfTargetFrame.nodes.find((node) => node.id === "actor-1")?.interactionCount).toBe(1)
    expect(selfTargetFrame.edges).toEqual([])
  })

  test("aggregates repeated actions into one directed graph edge", () => {
    const firstFrame = buildTimelineFrame(0, actorsReadyEvent())
    const publicFrame = buildTimelineFrame(1, interactionEvent({
      id: "interaction-1",
      roundIndex: 1,
      sourceActorId: "actor-1",
      targetActorIds: ["actor-2"],
      actionType: "briefing",
      content: "Actor 1 briefs Actor 2.",
      eventId: "event-1",
      visibility: "public",
      decisionType: "action",
      intent: "Brief.",
      expectation: "Actor 2 understands.",
    }), firstFrame)
    const privateFrame = buildTimelineFrame(2, interactionEvent({
      id: "interaction-2",
      roundIndex: 2,
      sourceActorId: "actor-1",
      targetActorIds: ["actor-2"],
      actionType: "warning",
      content: "Actor 1 warns Actor 2.",
      eventId: "event-1",
      visibility: "private",
      decisionType: "action",
      intent: "Warn.",
      expectation: "Actor 2 adjusts.",
    }), publicFrame)

    expect(privateFrame.edges).toHaveLength(1)
    expect(privateFrame.edges[0]).toMatchObject({
      id: "actor-1->actor-2",
      weight: 2,
      visibilityMix: { public: 1, private: 1 },
      actionTypes: { briefing: 1, warning: 1 },
      latestActionType: "warning",
    })
  })

  test("builds the actor roster before the first round frame and merges later rosters", () => {
    const initialActors = actorsReadyEvent()
    const addedActors: RunEvent = {
      type: "actors.ready",
      runId: "timeline-run",
      timestamp: "2026-04-28T00:02:00.000Z",
      actors: [
        { id: "actor-1", label: "Actor 1", role: "Role 1", intent: "", interactionCount: 0 },
        { id: "actor-2", label: "Actor 2", role: "Role 2", intent: "", interactionCount: 0 },
        { id: "actor-3", label: "Actor 3", role: "Role 3", intent: "", interactionCount: 0 },
      ],
    }
    const firstInteraction = interactionEvent({
      id: "interaction-1",
      roundIndex: 1,
      sourceActorId: "actor-1",
      targetActorIds: ["actor-2"],
      actionType: "briefing",
      content: "Actor 1 briefs Actor 2.",
      eventId: "event-1",
      visibility: "public",
      decisionType: "action",
      intent: "Brief.",
      expectation: "Actor 2 understands.",
    })
    const secondInteraction = interactionEvent({
      id: "interaction-2",
      roundIndex: 2,
      sourceActorId: "actor-3",
      targetActorIds: ["actor-1"],
      actionType: "warning",
      content: "Actor 3 warns Actor 1.",
      eventId: "event-1",
      visibility: "private",
      decisionType: "action",
      intent: "Warn.",
      expectation: "Actor 1 adjusts.",
    })
    const roundOne: RunEvent = {
      type: "round.completed",
      runId: "timeline-run",
      timestamp: "2026-04-28T00:01:00.000Z",
      roundIndex: 1,
    }
    const roundTwo: RunEvent = {
      type: "round.completed",
      runId: "timeline-run",
      timestamp: "2026-04-28T00:03:00.000Z",
      roundIndex: 2,
    }

    const firstFrame = buildTimelineFrame(0, roundOne, undefined, [initialActors, firstInteraction, roundOne])
    const secondFrame = buildTimelineFrame(1, roundTwo, firstFrame, [initialActors, firstInteraction, roundOne, addedActors, secondInteraction, roundTwo])

    expect(firstFrame.index).toBe(0)
    expect(firstFrame.layoutRoundIndex).toBe(1)
    expect(firstFrame.nodes.map((node) => node.id)).toEqual(["actor-1", "actor-2"])
    expect(firstFrame.activeNodeIds).toEqual(["actor-1", "actor-2"])
    expect(secondFrame.layoutRoundIndex).toBe(2)
    expect(secondFrame.nodes.map((node) => node.id)).toEqual(["actor-1", "actor-2", "actor-3"])
    expect(secondFrame.activeNodeIds).toEqual(["actor-3", "actor-1"])
    expect(secondFrame.edges).toHaveLength(2)
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

function actorsReadyEvent(): RunEvent {
  return {
    type: "actors.ready",
    runId: "timeline-run",
    timestamp: "2026-04-28T00:00:00.000Z",
    actors: [
      { id: "actor-1", label: "Actor 1", role: "Role 1", intent: "", interactionCount: 0 },
      { id: "actor-2", label: "Actor 2", role: "Role 2", intent: "", interactionCount: 0 },
    ],
  }
}

function interactionEvent(interaction: Interaction): RunEvent {
  return {
    type: "interaction.recorded",
    runId: "timeline-run",
    timestamp: "2026-04-28T00:00:00.000Z",
    interaction,
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
      expect(actorsFrame?.layoutRoundIndex).toBeUndefined()
      expect(actorsFrame?.nodes.map((node) => node.id)).toEqual(["actor-1", "actor-2"])
      expect(actorsFrame?.edges).toEqual([])
      expect(actorsFrame?.activeNodeIds).toEqual(["actor-1", "actor-2"])

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
      expect(interactionFrame?.layoutRoundIndex).toBeUndefined()
      expect(interactionFrame?.index).toBe(1)
      expect(interactionFrame?.edges).toHaveLength(1)
      expect(interactionFrame?.edges[0]?.weight).toBe(1)
      expect(interactionFrame?.activeNodeIds).toEqual(["actor-1", "actor-2"])

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
      expect(roundFrame?.index).toBe(2)
      expect(roundFrame?.edges).toHaveLength(1)
      expect(roundFrame?.edges[0]?.weight).toBe(1)
      expect(roundFrame?.nodes.find((node) => node.id === "actor-1")?.interactionCount).toBe(1)
      expect(roundFrame?.nodes.find((node) => node.id === "actor-2")?.interactionCount).toBe(1)
      expect(roundFrame?.activeNodeIds).toEqual(["actor-1", "actor-2"])

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
