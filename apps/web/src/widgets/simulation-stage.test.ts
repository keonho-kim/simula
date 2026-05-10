import { describe, expect, test } from "bun:test"
import type { ActorState, GraphNodeView, GraphTimelineFrame, RunEvent, SimulationState } from "@simula/shared"
import { renderToStaticMarkup } from "react-dom/server"
import { dictionary } from "@/lib/i18n/dictionary"
import { buildSimulationEventNotice } from "./simulation-event-notice"
import { SimulationEventNoticeCard } from "./simulation-event-notice-card"
import { buildInterludeStageView, buildSimulationInterlude } from "./simulation-stage-interlude"
import { buildSimulationStageStatus } from "./simulation-stage-status"

const runId = "run-test"
const timestamp = "2026-04-28T00:00:00.000Z"

describe("buildSimulationInterlude", () => {
  test("shows an overlay while Planner and Generator are preparing the run", () => {
    const events = [
      runStarted(),
      nodeStarted("planner", "Planner"),
      modelMessage("planner", "coreSituation: A tense opening situation."),
      nodeStarted("generator", "Generator"),
      modelMessage("generator", "actor-1 role: Mayor"),
    ]

    const interlude = buildSimulationInterlude(events)

    expect(interlude?.roleLabel).toBe("Generator")
    expect(interlude?.stepLabel).toBe("Role")
    expect(interlude?.actorCardProgress).toBe("1 step")
  })

  test("keeps the overlay after actor cards are ready and before actor action", () => {
    const events = [
      runStarted(),
      actorsReady(),
      nodeStarted("coordinator", "Coordinator"),
      modelMessage("coordinator", "runtimeFrame: Round one opens in council chambers."),
    ]

    const interlude = buildSimulationInterlude(events)

    expect(interlude?.roleLabel).toBe("Coordinator")
    expect(interlude?.stepLabel).toBe("Runtime Frame")
    expect(interlude?.actorCardProgress).toBe("ready")
  })

  test("removes repeated role prefixes from interlude model messages", () => {
    const events = [
      runStarted(),
      actorsReady(),
      nodeStarted("coordinator", "Coordinator"),
      modelMessage("coordinator", "Coordinator: runtimeFrame: Coordinator: The round is being framed."),
    ]

    const interlude = buildSimulationInterlude(events)

    expect(interlude?.stepLabel).toBe("Runtime Frame")
    expect(interlude?.message).toBe("The round is being framed.")
  })

  test("hides the overlay once the first actor action starts", () => {
    const events = [
      runStarted(),
      actorsReady(),
      modelMessage("actor", "A thought: I need leverage."),
      modelMessage("actor", "A action: Announces a compromise."),
    ]

    expect(buildSimulationInterlude(events)).toBeUndefined()
  })

  test("does not show the overlay again after the first actor action", () => {
    const events = [
      runStarted(),
      actorsReady(),
      modelMessage("actor", "A action: Announces a compromise."),
      roundCompleted(1),
      modelMessage("coordinator", "eventInjection: Keep continuity."),
      modelMessage("actor", "B thought: The offer has a weakness."),
    ]

    expect(buildSimulationInterlude(events)).toBeUndefined()
  })

  test("hides the overlay after terminal events", () => {
    const events = [
      runStarted(),
      actorsReady(),
      roundCompleted(1),
      {
        type: "run.completed",
        runId,
        timestamp,
        stopReason: "simulation_done",
      } satisfies RunEvent,
    ]

    expect(buildSimulationInterlude(events)).toBeUndefined()
  })

  test("hides the overlay after an event is injected", () => {
    const events = [
      runStarted(),
      actorsReady(),
      eventInjected(1),
    ]

    expect(buildSimulationInterlude(events)).toBeUndefined()
  })

  test("groups important interlude details by stage", () => {
    const events = [
      runStarted(),
      modelMessage("planner", "coreSituation: A tense opening situation."),
      modelMessage("generator", "roster: 1. A - Mayor"),
      modelMessage("generator", "actor-1 role: Mayor"),
      modelMessage("coordinator", "runtimeFrame: Round one opens in council chambers."),
    ]

    const view = buildInterludeStageView(events)

    expect(view.activeStageId).toBe("coordinator")
    expect(view.details.map((detail) => [detail.stageId, detail.stepLabel])).toEqual([
      ["coordinator", "Runtime Frame"],
      ["actorCards", "Role"],
      ["generator", "Roster"],
      ["planner", "Core Situation"],
    ])
  })

  test("does not show actors as a separate interlude stage", () => {
    const events = [
      runStarted(),
      actorsReady(),
      modelMessage("actor", "A thought: I need leverage."),
    ]

    const view = buildInterludeStageView(events)

    expect(view.stages.map((stage) => stage.id)).toEqual([
      "planner",
      "generator",
      "actorCards",
      "coordinator",
      "observer",
    ])
    expect(view.activeStageId).toBe("coordinator")
    expect(view.details[0]?.stageId).toBe("coordinator")
    expect(view.details[0]?.stepLabel).toBe("Thought")
  })

  test("does not add round completed events to interlude details", () => {
    const events = [
      runStarted(),
      actorsReady(),
      roundCompleted(1),
    ]

    const view = buildInterludeStageView(events)

    expect(view.details.map((detail) => detail.id)).not.toContain("round-1")
  })

  test("uses node events for stage status without showing them as details", () => {
    const events = [
      runStarted(),
      nodeStarted("planner", "Planner"),
      nodeCompleted("planner", "Planner"),
      nodeStarted("generator", "Generator"),
    ]

    const view = buildInterludeStageView(events)

    expect(view.details).toEqual([])
    expect(view.stages.find((stage) => stage.id === "planner")?.status).toBe("done")
    expect(view.stages.find((stage) => stage.id === "generator")?.status).toBe("active")
  })

  test("marks actor cards done when actors are ready", () => {
    const events = [
      runStarted(),
      modelMessage("generator", "actor-1 role: Mayor"),
      actorsReady(),
    ]

    const view = buildInterludeStageView(events)

    expect(view.stages.find((stage) => stage.id === "actorCards")?.status).toBe("done")
    expect(view.details[0]?.stageId).toBe("actorCards")
  })
})

describe("buildSimulationEventNotice", () => {
  test("shows the latest injected event until actor activity starts", () => {
    const notice = buildSimulationEventNotice([
      runStarted(),
      actorsReady(),
      eventInjected(1),
    ])

    expect(notice?.event.title).toBe("Public pressure")
    expect(notice?.event.roundIndex).toBe(1)
    expect(notice?.dismissalKey).toBe("run-test:round-1-event-1")
  })

  test("hides the injected event notice after same-round interaction", () => {
    expect(buildSimulationEventNotice([
      runStarted(),
      eventInjected(1),
      interactionRecorded(1),
    ])).toBeUndefined()
  })

  test("hides the injected event notice after same-round completion", () => {
    expect(buildSimulationEventNotice([
      runStarted(),
      eventInjected(1),
      roundCompleted(1),
    ])).toBeUndefined()
  })

  test("hides a stale injected event notice when a later round proceeds without another event", () => {
    expect(buildSimulationEventNotice([
      runStarted(),
      eventInjected(7),
      roundCompleted(8),
    ])).toBeUndefined()
  })

  test("renders a dismiss button for the injected event notice", () => {
    const notice = buildSimulationEventNotice([
      runStarted(),
      eventInjected(1),
    ])

    const html = renderToStaticMarkup(
      SimulationEventNoticeCard({
        notice,
        t: dictionary.en,
        onDismiss: () => undefined,
      })
    )

    expect(html).toContain('aria-label="Dismiss event notice"')
    expect(html).toContain("Public pressure")
  })
})

describe("buildSimulationStageStatus", () => {
  test("shows round one and all actors waiting after actors are ready", () => {
    const status = buildSimulationStageStatus([
      runStarted(),
      statusActorsReady(["actor-1", "actor-2", "actor-3"]),
    ], statusRunState(3, 8), [])

    expect(status).toEqual({
      currentRound: 1,
      maxRound: 8,
      respondedActors: 0,
      totalActors: 3,
      waitingActors: 3,
    })
  })

  test("counts responded and waiting actors from current round interactions", () => {
    const status = buildSimulationStageStatus([
      runStarted(),
      statusActorsReady(["actor-1", "actor-2", "actor-3"]),
      eventInjected(2),
      interactionRecordedBy(2, "actor-1"),
      interactionRecordedBy(2, "actor-2"),
    ], statusRunState(3, 8), [])

    expect(status).toMatchObject({
      currentRound: 2,
      respondedActors: 2,
      totalActors: 3,
      waitingActors: 1,
    })
  })

  test("shows no waiting actors after the current round completes", () => {
    const status = buildSimulationStageStatus([
      runStarted(),
      statusActorsReady(["actor-1", "actor-2", "actor-3"]),
      interactionRecordedBy(2, "actor-1"),
      roundCompleted(2),
    ], statusRunState(3, 8), [])

    expect(status).toMatchObject({
      currentRound: 2,
      respondedActors: 3,
      totalActors: 3,
      waitingActors: 0,
    })
  })

  test("keeps the last completed round after terminal events", () => {
    const status = buildSimulationStageStatus([
      runStarted(),
      statusActorsReady(["actor-1", "actor-2"]),
      roundCompleted(3),
      {
        type: "run.completed",
        runId,
        timestamp,
        stopReason: "simulation_done",
      },
    ], statusRunState(2, 8), [])

    expect(status).toMatchObject({
      currentRound: 3,
      respondedActors: 2,
      waitingActors: 0,
    })
  })

  test("falls back to latest timeline nodes when actor events and state are unavailable", () => {
    const status = buildSimulationStageStatus([
      runStarted(),
      eventInjected(1),
    ], undefined, [timelineFrame(["actor-1", "actor-2"])])

    expect(status).toMatchObject({
      currentRound: 1,
      totalActors: 2,
      waitingActors: 2,
    })
  })
})

function runStarted(): RunEvent {
  return { type: "run.started", runId, timestamp }
}

function nodeStarted(nodeId: string, label: string): RunEvent {
  return { type: "node.started", runId, timestamp, nodeId, label }
}

function nodeCompleted(nodeId: string, label: string): RunEvent {
  return { type: "node.completed", runId, timestamp, nodeId, label }
}

function modelMessage(role: Extract<RunEvent, { type: "model.message" }>["role"], content: string): RunEvent {
  return { type: "model.message", runId, timestamp, role, content }
}

function actorsReady(): RunEvent {
  const actors: GraphNodeView[] = [
    { id: "a", label: "A", role: "Mayor", intent: "", interactionCount: 0 },
    { id: "b", label: "B", role: "Engineer", intent: "", interactionCount: 0 },
  ]
  return { type: "actors.ready", runId, timestamp, actors }
}

function roundCompleted(roundIndex: number): RunEvent {
  return { type: "round.completed", runId, timestamp, roundIndex }
}

function eventInjected(roundIndex: number): RunEvent {
  return {
    type: "event.injected",
    runId,
    timestamp,
    event: {
      id: `round-${roundIndex}-event-1`,
      roundIndex,
      sourceEventId: "event-1",
      title: "Public pressure",
      summary: "A public pressure enters the round.",
    },
  }
}

function interactionRecorded(roundIndex: number): RunEvent {
  return interactionRecordedBy(roundIndex, "actor-1")
}

function interactionRecordedBy(roundIndex: number, sourceActorId: string): RunEvent {
  return {
    type: "interaction.recorded",
    runId,
    timestamp,
    interaction: {
      id: `round-${roundIndex}-${sourceActorId}`,
      roundIndex,
      sourceActorId,
      targetActorIds: ["actor-2"],
      actionType: "public-action",
      content: "Actor 1 applies pressure.",
      eventId: "event-1",
      visibility: "public",
      decisionType: "action",
      intent: "Create pressure.",
      expectation: "Actor 2 responds.",
    },
  }
}

function statusActorsReady(actorIds: string[]): RunEvent {
  return {
    type: "actors.ready",
    runId,
    timestamp,
    actors: actorIds.map((actorId) => ({
      id: actorId,
      label: actorId,
      role: "Actor",
      intent: "",
      interactionCount: 0,
    })),
  }
}

function statusRunState(actorCount: number, maxRound: number): SimulationState {
  return {
    runId,
    scenario: {
      sourceName: "scenario.md",
      text: "Scenario",
      controls: {
        numCast: actorCount,
        allowAdditionalCast: false,
        actionsPerType: 1,
        maxRound,
        fastMode: true,
      },
    },
    actors: Array.from({ length: actorCount }, (_, index) => actor(`actor-${index + 1}`)),
    interactions: [],
    roundDigests: [],
    roundReports: [],
    roleTraces: [],
    worldSummary: "",
    reportMarkdown: "",
    stopReason: "",
    errors: [],
  }
}

function actor(id: string): ActorState {
  return {
    id,
    name: id,
    role: "Actor",
    backgroundHistory: "",
    personality: "",
    preference: "",
    privateGoal: "",
    intent: "",
    actions: [],
    context: { visible: [] },
    contextSummary: "",
    memory: [],
    relationships: {},
  }
}

function timelineFrame(actorIds: string[]): GraphTimelineFrame {
  return {
    index: 0,
    timestamp,
    nodes: actorIds.map((actorId) => ({
      id: actorId,
      label: actorId,
      role: "Actor",
      intent: "",
      interactionCount: 0,
    })),
    edges: [],
    activeNodeIds: [],
    messages: [],
    logRefs: [],
  }
}
