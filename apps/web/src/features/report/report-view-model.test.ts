import { describe, expect, test } from "bun:test"
import type { RunEvent, SimulationState } from "@simula/shared"
import { buildActorOptions, buildReportTimeline, buildRoleDiagnostics } from "./report-view-model"

describe("report view model", () => {
  test("filters timeline interactions by source and target actor", () => {
    const state = createState()

    const ceoRounds = buildReportTimeline(state, "ceo")
    const ctoRounds = buildReportTimeline(state, "cto")

    expect(ceoRounds).toHaveLength(1)
    expect(ceoRounds[0]?.interactions.map((item) => item.id)).toEqual(["i1", "i2"])
    expect(ctoRounds).toHaveLength(1)
    expect(ctoRounds[0]?.interactions.map((item) => item.id)).toEqual(["i1"])
  })

  test("builds actor filter options with interaction counts", () => {
    const options = buildActorOptions(createState())

    expect(options).toEqual([
      expect.objectContaining({ id: "ceo", interactionCount: 2 }),
      expect.objectContaining({ id: "cto", interactionCount: 1 }),
      expect.objectContaining({ id: "cfo", interactionCount: 1 }),
    ])
  })

  test("summarizes system role diagnostics without exposing raw model output", () => {
    const events: RunEvent[] = [
      {
        type: "model.message",
        runId: "run-1",
        timestamp: "2026-04-28T00:00:00.000Z",
        role: "planner",
        content: "{\"raw\":\"secret planner chain\"}",
      },
      {
        type: "model.metrics",
        runId: "run-1",
        timestamp: "2026-04-28T00:00:01.000Z",
        metrics: {
          role: "planner",
          step: "coreSituation",
          attempt: 1,
          ttftMs: 10,
          durationMs: 30,
          inputTokens: 100,
          outputTokens: 20,
          totalTokens: 120,
          tokenSource: "provider",
        },
      },
      {
        type: "node.completed",
        runId: "run-1",
        timestamp: "2026-04-28T00:00:02.000Z",
        nodeId: "coordinator",
        label: "Coordinator",
      },
      {
        type: "log",
        runId: "run-1",
        timestamp: "2026-04-28T00:00:03.000Z",
        level: "info",
        message: "observer summarized round 1",
      },
    ]

    const diagnostics = buildRoleDiagnostics(events)
    const planner = diagnostics.summaries.find((summary) => summary.role === "planner")
    const bodies = diagnostics.events.map((event) => event.body).join("\n")

    expect(planner?.messageCount).toBe(1)
    expect(planner?.metricCount).toBe(1)
    expect(diagnostics.summaries.find((summary) => summary.role === "coordinator")?.nodeEventCount).toBe(1)
    expect(diagnostics.summaries.find((summary) => summary.role === "observer")?.logCount).toBe(1)
    expect(bodies).not.toContain("secret planner chain")
    expect(bodies).not.toContain("{\"raw\"")
  })
})

function createState(): SimulationState {
  return {
    runId: "run-1",
    scenario: {
      sourceName: "scenario.md",
      text: "Scenario",
      controls: {
        numCast: 3,
        allowAdditionalCast: false,
        actionsPerType: 1,
        maxRound: 2,
        fastMode: true,
      },
    },
    actors: [
      createActor("ceo", "Founder CEO"),
      createActor("cto", "CTO"),
      createActor("cfo", "CFO"),
    ],
    interactions: [
      {
        id: "i1",
        roundIndex: 1,
        sourceActorId: "ceo",
        targetActorIds: ["cto"],
        actionType: "private_call",
        content: "CEO asks CTO for a containment plan.",
        eventId: "event-1",
        visibility: "private",
        decisionType: "action",
        intent: "Clarify the security risk.",
        expectation: "CTO shares a concrete plan.",
      },
      {
        id: "i2",
        roundIndex: 1,
        sourceActorId: "cfo",
        targetActorIds: ["ceo"],
        actionType: "board_warning",
        content: "CFO warns that runway is shrinking.",
        eventId: "event-2",
        visibility: "semi-public",
        decisionType: "action",
        intent: "Force a board decision.",
        expectation: "CEO accepts financial constraints.",
      },
    ],
    roundDigests: [{
      roundIndex: 1,
      preRound: { elapsedTime: "1 hour", content: "Pressure increases." },
      afterRound: { content: "The board conflict sharpens." },
    }],
    roundReports: [{
      roundIndex: 1,
      title: "Board pressure rises",
      summary: "The leadership team starts trading concessions.",
      keyInteractions: ["CEO calls CTO"],
      actorImpacts: ["CFO gains leverage"],
      unresolvedQuestions: ["Will the CEO accept restructuring?"],
    }],
    roleTraces: [],
    worldSummary: "Summary",
    reportMarkdown: "# Report",
    stopReason: "simulation_done",
    errors: [],
  }
}

function createActor(id: string, name: string) {
  return {
    id,
    name,
    role: `${name} role`,
    backgroundHistory: "",
    personality: "",
    preference: "",
    privateGoal: "",
    intent: "",
    actions: [],
    context: {
      public: [],
      semiPublic: {},
      private: {},
      solitary: [],
    },
    contextSummary: "",
    memory: [],
    relationships: {},
  }
}
