import { describe, expect, test } from "bun:test"
import type { ActorState, Interaction, SimulationState } from "@simula/shared"
import { calculateNetworkDynamics } from "../src/simulation/network-dynamics"

describe("network dynamics", () => {
  test("computes directed actor and relationship metrics", () => {
    const dynamics = calculateNetworkDynamics(createState([
      interaction("i1", 1, "ceo", ["cto"], "private"),
      interaction("i2", 1, "ceo", ["cfo"], "public"),
      interaction("i3", 2, "cto", ["ceo"], "private"),
    ]))

    expect(dynamics.summary.validActionCount).toBe(3)
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

  test("detects reciprocal pairs only when both directions exist", () => {
    const dynamics = calculateNetworkDynamics(createState([
      interaction("i1", 1, "ceo", ["cto"], "private"),
      interaction("i2", 2, "cto", ["ceo"], "private"),
      interaction("i3", 2, "cfo", ["ceo"], "public"),
    ]))

    expect(dynamics.summary.reciprocalPairCount).toBe(1)
    expect(dynamics.summary.highestReciprocityPairs.map((pair) => `${pair.sourceActorId}-${pair.targetActorId}`)).toEqual([
      "ceo-cto",
    ])
    expect(dynamics.relationshipMetrics.find((relationship) => relationship.sourceActorId === "ceo" && relationship.targetActorId === "cfo")?.reciprocal).toBe(false)
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
  decisionType: Interaction["decisionType"] = "action"
): Interaction {
  return {
    id,
    roundIndex,
    sourceActorId,
    targetActorIds,
    actionType: decisionType,
    content: `${sourceActorId} to ${targetActorIds.join(", ")}`,
    eventId: "event-1",
    visibility,
    decisionType,
    intent: "Act.",
    expectation: "Change the network.",
  }
}
