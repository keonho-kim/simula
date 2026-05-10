import { describe, expect, test } from "bun:test"
import type { ActorState, Interaction, SimulationState } from "@simula/shared"
import { buildReportAnalysisViewModel } from "./report-analysis-view-model"

describe("report analysis view model", () => {
  test("returns undefined without a run state", () => {
    expect(buildReportAnalysisViewModel(undefined)).toBeUndefined()
  })

  test("builds dashboard slices from simulation state", () => {
    const model = buildReportAnalysisViewModel(createState([
      interaction("i1", 1, "ceo", ["cto"], "private", "briefing"),
      interaction("i2", 2, "cto", ["ceo"], "private", "reply"),
      interaction("i3", 2, "ceo", ["cfo"], "public", "vote"),
    ]))

    expect(model?.hasNetworkData).toBe(true)
    expect(model?.topActors[0]?.actorId).toBe("ceo")
    expect(model?.strongestDyads[0]).toMatchObject({
      sourceActorId: "ceo",
      targetActorId: "cto",
      totalWeight: 2,
    })
    expect(model?.behaviorRanking[0]).toMatchObject({
      actorId: "ceo",
      actionCount: 2,
      uniqueActionTypes: 2,
    })
    expect(model?.eventAlignment[0]).toMatchObject({
      eventId: "event-1",
      jaccardAlignment: 1,
    })
    expect(model?.heatmapRows.find((row) => row.actorId === "ceo")?.cells).toEqual([0, 2, 1])
    expect(model?.maxRelationshipWeight).toBe(2)
  })

  test("keeps empty runs renderable", () => {
    const model = buildReportAnalysisViewModel(createState([]))

    expect(model?.hasNetworkData).toBe(false)
    expect(model?.topActors).toHaveLength(3)
    expect(model?.strongestDyads).toEqual([])
    expect(model?.heatmapRows.every((row) => row.cells.every((cell) => cell === 0))).toBe(true)
  })
})

function createState(interactions: Interaction[]): SimulationState {
  return {
    runId: "run-1",
    scenario: {
      sourceName: "scenario.md",
      text: "Scenario",
      controls: {
        numCast: 3,
        allowAdditionalCast: false,
        actionsPerType: 1,
        maxRound: 3,
        fastMode: true,
      },
    },
    plan: {
      interpretation: "Interpretation",
      backgroundStory: "Background",
      actionCatalog: [],
      majorEvents: [{
        id: "event-1",
        title: "Board decision",
        summary: "The board decision must complete.",
        status: "completed",
        participantIds: ["ceo", "cto", "cfo"],
      }],
    },
    actors: [
      actor("ceo", "CEO"),
      actor("cto", "CTO"),
      actor("cfo", "CFO"),
    ],
    interactions,
    roundDigests: [],
    roundReports: [],
    roleTraces: [],
    worldSummary: "Summary",
    reportMarkdown: "",
    stopReason: "simulation_done",
    errors: [],
  }
}

function actor(id: string, name: string): ActorState {
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
    context: { visible: [] },
    contextSummary: "",
    memory: [],
    relationships: {},
  }
}

function interaction(
  id: string,
  roundIndex: number,
  sourceActorId: string,
  targetActorIds: string[],
  visibility: Interaction["visibility"],
  actionType: string
): Interaction {
  return {
    id,
    roundIndex,
    sourceActorId,
    targetActorIds,
    actionType,
    content: `${sourceActorId} to ${targetActorIds.join(", ")}`,
    eventId: "event-1",
    visibility,
    decisionType: "action",
    intent: "Act.",
    expectation: "Change the network.",
  }
}
