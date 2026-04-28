import { describe, expect, test } from "bun:test"
import type { GraphNodeView, RunEvent } from "@simula/shared"
import { buildSimulationInterlude } from "./simulation-stage-interlude"

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

  test("hides the overlay once the first actor action starts", () => {
    const events = [
      runStarted(),
      actorsReady(),
      modelMessage("actor", "A thought: I need leverage."),
      modelMessage("actor", "A action: Announces a compromise."),
    ]

    expect(buildSimulationInterlude(events)).toBeUndefined()
  })

  test("shows the overlay again after a round completes until the next actor action", () => {
    const events = [
      runStarted(),
      actorsReady(),
      modelMessage("actor", "A action: Announces a compromise."),
      roundCompleted(1),
      modelMessage("coordinator", "eventInjection: Keep continuity."),
      modelMessage("actor", "B thought: The offer has a weakness."),
    ]

    const interlude = buildSimulationInterlude(events)

    expect(interlude?.roleLabel).toBe("Actor")
    expect(interlude?.stepLabel).toBe("Thought")
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
})

function runStarted(): RunEvent {
  return { type: "run.started", runId, timestamp }
}

function nodeStarted(nodeId: string, label: string): RunEvent {
  return { type: "node.started", runId, timestamp, nodeId, label }
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
