/**
 * Purpose: Provide focused simulation fixtures shared by prompt and actor contract tests.
 * Pattern: Test fixture factory.
 * Usage: Imported only by tests in packages/core/tests.
 * Related: packages/core/tests/prompt-contracts.test.ts, packages/core/tests/actor-contracts.test.ts
 */
import { defaultSettings } from "@/backend/core/settings/defaults"
import type { ActorGraphState } from "@/backend/core/simulation/roles/actor"
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"
import type { PlannedEvent, SimulationState } from "@/shared"

export function buildDigestSimulation(): SimulationState {
  return {
    runId: "digest-run",
    scenario: {
      sourceName: "digest.md",
      text: "A board faces an emergency decision.",
      controls: { numCast: 1, allowAdditionalCast: true, actionsPerType: 1, maxRound: 8, fastMode: false },
    },
    plan: {
      interpretation: "A board faces an emergency decision.",
      backgroundStory: "Legacy summary.",
      scenarioDigest: {
        coreSituation: "A board must choose under time pressure.",
        actorPressures: "Stakeholders face cost.",
        conflictDynamics: "Public and private pressure collide.",
        simulationDirection: "Resolve responsibility.",
      },
      actionCatalog: {},
      majorEvents: [
        {
          id: "event-1",
          title: "Digest Beat 1",
          summary: "Pressure becomes visible.",
          status: "pending",
          participantIds: ["actor-1"],
        },
      ],
    },
    actors: [
      {
        id: "actor-1",
        name: "Actor 1",
        role: "Primary decision maker",
        backgroundHistory: "History under pressure.",
        personality: "Pragmatic.",
        preference: "Protect authority.",
        privateGoal: "Keep authority.",
        intent: "Choose a path.",
        actions: [],
        context: { visible: [] },
        memory: [],
        relationships: {},
        contextSummary: "",
      },
    ],
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

export function buildCoordinatorPromptState(events: PlannedEvent[]): WorkflowState {
  const simulation = buildDigestSimulation()
  return {
    runId: "coordinator-prompt-run",
    scenario: simulation.scenario,
    settings: defaultSettings(),
    simulation: {
      ...simulation,
      plan: simulation.plan ? { ...simulation.plan, majorEvents: events } : simulation.plan,
    },
  }
}

export function plannedEvent(id: string, status: PlannedEvent["status"]): PlannedEvent {
  return {
    id,
    title: `Event ${id.replace("event-", "")}`,
    summary: `Summary for ${id}.`,
    status,
    participantIds: ["actor-1"],
  }
}

export function buildActorChoiceState(): ActorGraphState {
  const simulation = buildDigestSimulation()
  const baseActor = simulation.actors[0]
  const event = simulation.plan?.majorEvents[0]
  if (!baseActor || !event) {
    throw new Error("Actor choice fixture is incomplete.")
  }
  const actor = {
    ...baseActor,
    actions: [
      {
        id: "actor-1-public-1",
        visibility: "public" as const,
        label: "Public move 1",
        intentHint: "Open pressure.",
        expectedOutcome: "Public pressure increases.",
      },
    ],
  }
  const target = {
    ...actor,
    id: "actor-2",
    name: "Actor 2",
    backgroundHistory: "Target history.",
    actions: [],
  }
  return {
    runId: "choice-run",
    scenario: simulation.scenario,
    plannerDigest: "Digest.",
    settings: defaultSettings(),
    actor,
    actors: [actor, target],
    event,
    roundDigest: {
      roundIndex: 1,
      preRound: { elapsedTime: "Opening", content: "Pressure is visible." },
    },
    roundIndex: 1,
    coordinatorTrace: {
      role: "coordinator",
      runtimeFrame: "Coordinate pressure.",
      actorRouting: "Route actors.",
      interactionPolicy: "Respect boundaries.",
      outcomeDirection: "Advance conflict.",
      eventInjection: "",
      eventResolution: "",
      progressDecision: "",
      retryCounts: {
        runtimeFrame: 0,
        actorRouting: 0,
        interactionPolicy: 0,
        outcomeDirection: 0,
        eventInjection: 0,
        eventResolution: 0,
        progressDecision: 0,
      },
    },
    trace: {
      thought: "",
      target: "",
      action: "",
      intent: "",
      message: "",
      retryCounts: { thought: 0, target: 0, action: 0, intent: 0, message: 0, context: 0 },
    },
  }
}
