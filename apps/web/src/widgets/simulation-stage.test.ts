import { describe, expect, test } from "bun:test"
import type { GraphNodeView, RunEvent } from "@simula/shared"
import { buildSimulationEventNotice } from "./simulation-event-notice"
import { buildInterludeStageView, buildSimulationInterlude } from "./simulation-stage-interlude"

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
  return {
    type: "interaction.recorded",
    runId,
    timestamp,
    interaction: {
      id: `round-${roundIndex}-actor-1`,
      roundIndex,
      sourceActorId: "actor-1",
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
