import { describe, expect, test } from "bun:test"
import type { ActorState, Interaction, SimulationState } from "../src"
import { calculateNetworkDynamics, calculateRunAnalysis } from "../src"

describe("run analysis", () => {
  test("computes directed network metrics and standard graph structure metrics", () => {
    const dynamics = calculateNetworkDynamics(createState([
      interaction("i1", 1, "ceo", ["cto"], "private", "action", "briefing"),
      interaction("i2", 1, "ceo", ["cfo"], "public", "action", "briefing"),
      interaction("i3", 2, "cto", ["ceo"], "private", "action", "escalation"),
    ]))

    expect(dynamics.summary.validActionCount).toBe(3)
    expect(dynamics.summary.directedDensity).toBeCloseTo(0.5)
    expect(dynamics.summary.undirectedDensity).toBeCloseTo(2 / 3)
    expect(dynamics.summary.reciprocity).toBeCloseTo(0.5)
    expect(dynamics.summary.clusteringCoefficient).toBe(0)
    expect(dynamics.summary.connectedComponentCount).toBe(1)
    expect(dynamics.summary.largestComponentSize).toBe(3)
    expect(dynamics.summary.isolateCount).toBe(0)
    expect(dynamics.summary.degreeCentralization).toBe(1)
    expect(dynamics.summary.tieStrengthGini).toBeCloseTo(1 / 6)
    expect(dynamics.summary.tieStrengthHhi).toBeCloseTo(5 / 9)
    expect(dynamics.actorMetrics.find((metric) => metric.actorId === "ceo")).toMatchObject({
      sentCount: 2,
      receivedCount: 1,
      weightedDegree: 3,
      uniqueCounterparties: 2,
      firstActiveRound: 1,
      lastActiveRound: 2,
      visibilityMix: { private: 2, public: 1 },
    })
    expect(dynamics.relationshipMetrics[0]).toMatchObject({
      sourceActorId: "ceo",
      targetActorId: "cto",
      totalWeight: 2,
      reciprocal: true,
      firstRound: 1,
      lastRound: 2,
      visibilityMix: { private: 2 },
    })
    expect(dynamics.relationshipMetrics[0]?.directionCounts).toEqual({
      "ceo->cto": 1,
      "cto->ceo": 1,
    })
  })

  test("computes clustering for a closed undirected triad", () => {
    const dynamics = calculateNetworkDynamics(createState([
      interaction("i1", 1, "ceo", ["cto"], "private"),
      interaction("i2", 1, "cto", ["cfo"], "private"),
      interaction("i3", 1, "cfo", ["ceo"], "private"),
    ]))

    expect(dynamics.summary.undirectedDensity).toBe(1)
    expect(dynamics.summary.clusteringCoefficient).toBe(1)
    expect(dynamics.summary.degreeCentralization).toBe(0)
    expect(dynamics.summary.reciprocity).toBe(0)
  })

  test("ignores no-action, self-target, targetless, and unknown-target interactions", () => {
    const dynamics = calculateNetworkDynamics(createState([
      interaction("i1", 1, "ceo", ["cto"], "private"),
      interaction("i2", 1, "ceo", [], "solitary", "no_action"),
      interaction("i3", 2, "ceo", ["ceo"], "public"),
      interaction("i4", 2, "cto", [], "solitary"),
      interaction("i5", 3, "cto", ["missing"], "private"),
    ]))

    expect(dynamics.summary.validActionCount).toBe(1)
    expect(dynamics.relationshipMetrics).toHaveLength(1)
    expect(dynamics.actorMetrics.find((metric) => metric.actorId === "ceo")?.weightedDegree).toBe(1)
    expect(dynamics.actorMetrics.find((metric) => metric.actorId === "cto")?.weightedDegree).toBe(1)
  })

  test("tracks round progression and new ties", () => {
    const dynamics = calculateNetworkDynamics(createState([
      interaction("i1", 1, "ceo", ["cto"], "private"),
      interaction("i2", 1, "ceo", ["cfo"], "private"),
      interaction("i3", 2, "cto", ["ceo"], "private"),
      interaction("i4", 3, "cto", ["cfo"], "public"),
    ]))

    expect(dynamics.roundMetrics).toEqual([
      {
        roundIndex: 1,
        actionCount: 2,
        activeActorCount: 3,
        newTies: 2,
        strongestActorId: "ceo",
        strongestActorName: "CEO",
        strongestActorWeight: 2,
      },
      {
        roundIndex: 2,
        actionCount: 1,
        activeActorCount: 2,
        newTies: 0,
        strongestActorId: "ceo",
        strongestActorName: "CEO",
        strongestActorWeight: 1,
      },
      {
        roundIndex: 3,
        actionCount: 1,
        activeActorCount: 2,
        newTies: 1,
        strongestActorId: "cfo",
        strongestActorName: "CFO",
        strongestActorWeight: 1,
      },
    ])
  })

  test("computes actor behavior diversity and coordinator event alignment", () => {
    const analysis = calculateRunAnalysis(createState([
      interaction("i1", 1, "ceo", ["cto"], "private", "action", "briefing", "event-1"),
      interaction("i2", 2, "ceo", ["cfo"], "private", "action", "briefing", "event-1"),
      interaction("i3", 3, "ceo", ["cto"], "public", "action", "vote", "event-1"),
      interaction("i4", 3, "cfo", ["ceo"], "public", "action", "warning", "event-2"),
    ]))

    const ceo = analysis.behavior.find((metric) => metric.actorId === "ceo")
    expect(ceo).toMatchObject({
      actionCount: 3,
      uniqueActionTypes: 2,
      uniqueVisibilities: 2,
      uniqueCounterparties: 2,
      targetSpread: 1,
      consecutiveRepeatRate: 0.5,
    })
    expect(ceo?.actionTypeEntropy).toBeCloseTo(0.918, 3)
    expect(ceo?.normalizedActionTypeEntropy).toBeCloseTo(0.918, 3)
    expect(analysis.coordinator.find((metric) => metric.eventId === "event-1")).toMatchObject({
      plannedParticipantCount: 2,
      actualParticipantCount: 3,
      overlapCount: 2,
      interactionCount: 3,
      injectedRounds: [1],
    })
    expect(analysis.coordinator.find((metric) => metric.eventId === "event-1")?.jaccardAlignment).toBeCloseTo(2 / 3)
    expect(analysis.summary.completedEventCount).toBe(1)
    expect(analysis.summary.totalEventCount).toBe(2)
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
      majorEvents: [
        {
          id: "event-1",
          title: "Board vote",
          summary: "The board vote must be resolved.",
          status: "completed",
          participantIds: ["ceo", "cto"],
        },
        {
          id: "event-2",
          title: "Finance warning",
          summary: "Finance pressure may alter the decision.",
          status: "partial",
          participantIds: ["cfo"],
        },
      ],
    },
    actors: [
      actor("ceo", "CEO"),
      actor("cto", "CTO"),
      actor("cfo", "CFO"),
    ],
    interactions,
    roundDigests: [{
      roundIndex: 1,
      injectedEventId: "event-1",
      preRound: { elapsedTime: "1 hour", content: "Pressure rises." },
    }],
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
  decisionType: Interaction["decisionType"] = "action",
  actionType = decisionType,
  eventId = "event-1"
): Interaction {
  return {
    id,
    roundIndex,
    sourceActorId,
    targetActorIds,
    actionType,
    content: `${sourceActorId} to ${targetActorIds.join(", ")}`,
    eventId,
    visibility,
    decisionType,
    intent: "Act.",
    expectation: "Change the network.",
  }
}
