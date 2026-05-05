import { describe, expect, test } from "bun:test"
import type { ActorState, Interaction, SimulationState } from "@simula/shared"
import { renderReport } from "../src/simulation/reporting"

describe("report rendering", () => {
  test("renders a concise benchmark report without raw actor utterances or diagnostics", () => {
    const report = renderReport(createState())

    expect(report).toContain("# Simula Report")
    expect(report).toContain("## Outcome")
    expect(report).toContain("## Benchmark Summary")
    expect(report).toContain("## Major Event Results")
    expect(report).toContain("## Network Dynamics")
    expect(report).toContain("## Actor Relationship Map")
    expect(report).toContain("## Round Progression")
    expect(report).toContain("## Cast")
    expect(report).toContain("## Run Metadata")
    expect(report).not.toContain("## Actor Cards")
    expect(report).not.toContain("## Actor Actions")
    expect(report).not.toContain("## Actor Context")
    expect(report).not.toContain("## Role Traces")
    expect(report).not.toContain("CEO: raw private statement")
    expect(report).not.toContain("secret planner trace")
  })
})

function createState(): SimulationState {
  return {
    runId: "run-1",
    scenario: {
      sourceName: "scenario.md",
      text: "Scenario",
      controls: {
        numCast: 2,
        allowAdditionalCast: false,
        actionsPerType: 1,
        maxRound: 1,
        fastMode: true,
      },
    },
    plan: {
      interpretation: "Interpretation",
      backgroundStory: "Background",
      scenarioDigest: {
        coreSituation: "A board crisis is underway.",
        actorPressures: "Leaders face opposing pressure.",
        conflictDynamics: "Private pressure drives the action chain.",
        simulationDirection: "Resolve the leadership path.",
      },
      actionCatalog: [],
      majorEvents: [{
        id: "event-1",
        title: "Board decision",
        summary: "The board decision completed.",
        status: "completed",
        participantIds: ["ceo", "cto"],
      }],
    },
    actors: [
      actor("ceo", "CEO", "Protect company value."),
      actor("cto", "CTO", "Contain technical risk."),
    ],
    interactions: [
      interaction("i1", 1, "ceo", ["cto"], "CEO: raw private statement"),
      interaction("i2", 1, "cto", ["ceo"], "CTO: raw reply"),
    ],
    roundDigests: [{
      roundIndex: 1,
      preRound: { elapsedTime: "1 hour", content: "Pressure builds." },
    }],
    roundReports: [{
      roundIndex: 1,
      title: "Pressure narrows",
      roundSummary: "The actors converge on a board decision.",
    }],
    roleTraces: [{
      role: "planner",
      coreSituation: "secret planner trace",
      actorPressures: "secret planner trace",
      conflictDynamics: "secret planner trace",
      simulationDirection: "secret planner trace",
      majorEvents: "secret planner trace",
      retryCounts: {
        coreSituation: 0,
        actorPressures: 0,
        conflictDynamics: 0,
        simulationDirection: 0,
        majorEvents: 0,
      },
    }],
    worldSummary: "The board path resolved.",
    reportMarkdown: "",
    stopReason: "simulation_done",
    errors: [],
  }
}

function actor(id: string, name: string, intent: string): ActorState {
  return {
    id,
    name,
    role: `${name} role`,
    backgroundHistory: "Verbose background",
    personality: "Verbose personality",
    preference: "Verbose preference",
    privateGoal: "Verbose private goal",
    intent,
    actions: [],
    context: { visible: [] },
    contextSummary: "",
    memory: [],
    relationships: {},
  }
}

function interaction(id: string, roundIndex: number, sourceActorId: string, targetActorIds: string[], content: string): Interaction {
  return {
    id,
    roundIndex,
    sourceActorId,
    targetActorIds,
    actionType: "private-action",
    content,
    eventId: "event-1",
    visibility: "private",
    decisionType: "action",
    intent: "Move the decision.",
    expectation: "The target responds.",
  }
}
