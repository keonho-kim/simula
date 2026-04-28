import { describe, expect, test } from "bun:test"
import {
  parseScenarioDocument,
  validateSettings,
  defaultSettings,
  normalizeSettings,
  plannerDigestSummary,
  renderPromptLanguageGuide,
  resolveRoleSettings,
} from "../src"
import { actorPrompts } from "../src/simulation/roles/actor/prompts"
import { isValidActorAction, isValidActorTarget } from "../src/simulation/roles/actor/state"
import { actorCardPrompts } from "../src/simulation/roles/generator/card-prompts"
import { coordinatorPrompts } from "../src/simulation/roles/coordinator/prompts"
import { buildRepairChoicePrompt } from "../src/simulation/roles/repair"
import type { ActorGraphState } from "../src/simulation/roles/actor"
import { initialActorCardState } from "../src/simulation/roles/generator/card-state"
import { parseActorRoster } from "../src/simulation/roles/generator/roster"
import type { WorkflowState } from "../src/simulation/state"
import type { SimulationState } from "@simula/shared"

describe("scenario parsing", () => {
  test("parses frontmatter controls and body", () => {
    const scenario = parseScenarioDocument(`---\nnum_cast: 3\nallow_additional_cast: false\n---\nA crisis unfolds.`)

    expect(scenario.controls).toEqual({ numCast: 3, allowAdditionalCast: false, actionsPerType: 3, maxRound: 8, fastMode: false })
    expect(scenario.text).toBe("A crisis unfolds.")
  })

  test("rejects unsupported controls", () => {
    expect(() => parseScenarioDocument(`---\nnum_cast: 3\nfoo: bar\n---\nBody`)).toThrow(
      "Unsupported scenario control"
    )
  })

  test("parses actions per type from frontmatter", () => {
    const scenario = parseScenarioDocument(
      `---\nnum_cast: 2\nallow_additional_cast: true\nactions_per_type: 4\n---\nA crisis unfolds.`
    )

    expect(scenario.controls.actionsPerType).toBe(4)
  })

  test("parses fast mode from frontmatter", () => {
    const scenario = parseScenarioDocument(
      `---\nnum_cast: 2\nallow_additional_cast: true\nactions_per_type: 4\nfast_mode: true\n---\nA crisis unfolds.`
    )

    expect(scenario.controls.fastMode).toBe(true)
  })

  test("parses actor context token budget from frontmatter", () => {
    const scenario = parseScenarioDocument(
      `---\nnum_cast: 2\nactor_context_token_budget: 1200\n---\nA crisis unfolds.`
    )

    expect(scenario.controls.actorContextTokenBudget).toBe(1200)
  })

  test("parses max round from frontmatter", () => {
    const scenario = parseScenarioDocument(`---\nnum_cast: 2\nmax_round: 4\n---\nA crisis unfolds.`)

    expect(scenario.controls.maxRound).toBe(4)
  })

  test("renders prompt language guide without changing machine-readable tokens", () => {
    const guide = renderPromptLanguageGuide("ko")

    expect(guide).toContain("Korean")
    expect(guide).toContain("actor ids")
    expect(renderPromptLanguageGuide(undefined)).toContain("English")
  })

  test("shares planner scenario digest with downstream prompts", () => {
    const simulation = buildDigestSimulation()
    const actor = simulation.actors[0]
    const event = simulation.plan?.majorEvents[0]
    if (!actor || !event) {
      throw new Error("Digest simulation fixture is incomplete.")
    }
    const workflowState = {
      runId: "digest-run",
      scenario: simulation.scenario,
      settings: defaultSettings(),
      simulation,
    } satisfies WorkflowState
    const actorState = {
      runId: "digest-run",
      scenario: simulation.scenario,
      plannerDigest: plannerDigestSummary(simulation.plan, simulation.scenario.text),
      settings: defaultSettings(),
      actor,
      actors: simulation.actors,
      event,
      roundDigest: {
        roundIndex: 1,
        preRound: { elapsedTime: "Opening", content: "Pressure is visible." },
        afterRound: { content: "" },
      },
      roundIndex: 1,
      coordinatorTrace: {
        role: "coordinator",
        runtimeFrame: "Coordinate pressure.",
        actorRouting: "Route all actors.",
        interactionPolicy: "Respect visibility boundaries.",
        outcomeDirection: "Advance the conflict.",
        eventInjection: "",
        progressDecision: "",
        extensionDecision: "",
        retryCounts: {
          runtimeFrame: 0,
          actorRouting: 0,
          interactionPolicy: 0,
          outcomeDirection: 0,
          eventInjection: 0,
          progressDecision: 0,
          extensionDecision: 0,
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
    } satisfies ActorGraphState

    expect(
      actorCardPrompts.role(
        initialActorCardState({
          runId: "digest-run",
          scenario: simulation.scenario,
          settings: defaultSettings(),
          actorIndex: 1,
          assignedName: "Actor 1",
          roleSeed: "Primary decision maker",
          fullRoster: [{ index: 1, name: "Actor 1", roleSeed: "Primary decision maker" }],
          plannerDigest: plannerDigestSummary(simulation.plan, simulation.scenario.text),
          emit: async () => {},
        })
      )
    ).toContain("Actor pressures: Stakeholders face cost.")
    expect(coordinatorPrompts.runtimeFrame(workflowState, {})).toContain("Conflict dynamics: Public and private pressure collide.")
    expect(actorPrompts.thought(actorState, {})).toContain("Simulation direction: Resolve responsibility.")
  })

  test("parses unique plain text actor roster", () => {
    expect(parseActorRoster("1. Dana - Channel lead\n2. Min - Consumer advocate", 2)).toEqual([
      { index: 1, name: "Dana", roleSeed: "Channel lead" },
      { index: 2, name: "Min", roleSeed: "Consumer advocate" },
    ])
  })

  test("rejects duplicate actor roster names", () => {
    expect(() => parseActorRoster("1. Dana - Channel lead\n2. Dana - Consumer advocate", 2)).toThrow(
      "duplicate actor name"
    )
  })

  test("requires exact actor and action ids for actor choices", () => {
    const state = buildActorChoiceState()

    expect(actorPrompts.target(state, { thought: "Pressure is visible." })).toContain("- actor-2")
    expect(actorPrompts.action(state, { target: "actor-2" })).toContain("- actor-1-public-1")
    expect(isValidActorTarget("actor-2", state)).toBe(true)
    expect(isValidActorTarget("None", state)).toBe(true)
    expect(isValidActorTarget("Actor 2", state)).toBe(false)
    expect(isValidActorTarget("actor-2.", state)).toBe(false)
    expect(isValidActorTarget("none", state)).toBe(false)
    expect(isValidActorAction("actor-1-public-1", state)).toBe(true)
    expect(isValidActorAction("no_action", state)).toBe(true)
    expect(isValidActorAction("Public move 1", state)).toBe(false)
    expect(isValidActorAction("None", state)).toBe(false)
  })

  test("builds repair prompt with raw invalid output and exact allowed values", () => {
    const prompt = buildRepairChoicePrompt({
      sourceRole: "actor",
      sourceStep: "action",
      sourceId: "actor-1",
      invalidText: "I will make a public move.",
      allowedOutputs: ["actor-1-public-1", "no_action"],
    })

    expect(prompt).toContain("Invalid response:\nI will make a public move.")
    expect(prompt).toContain("- actor-1-public-1")
    expect(prompt).toContain("- no_action")
    expect(prompt).toContain("Return exactly one allowed output")
  })
})

function buildDigestSimulation(): SimulationState {
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
      actionCatalog: [],
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
        context: {
          public: [],
          semiPublic: {},
          private: {},
          solitary: [],
        },
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

function buildActorChoiceState(): ActorGraphState {
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
      afterRound: { content: "" },
    },
    roundIndex: 1,
    coordinatorTrace: {
      role: "coordinator",
      runtimeFrame: "Coordinate pressure.",
      actorRouting: "Route actors.",
      interactionPolicy: "Respect boundaries.",
      outcomeDirection: "Advance conflict.",
      eventInjection: "",
      progressDecision: "",
      extensionDecision: "",
      retryCounts: {
        runtimeFrame: 0,
        actorRouting: 0,
        interactionPolicy: 0,
        outcomeDirection: 0,
        eventInjection: 0,
        progressDecision: 0,
        extensionDecision: 0,
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

describe("settings validation", () => {
  test("fails explicitly when provider key is missing", () => {
    expect(() => validateSettings(defaultSettings())).toThrow("API key is required")
  })

  test("includes StoryBuilder settings", () => {
    expect(defaultSettings().roles.storyBuilder.model).toBeTruthy()
  })

  test("includes actor settings", () => {
    expect(defaultSettings().roles.actor.model).toBeTruthy()
    expect(defaultSettings().roles.actor.contextTokenBudget).toBe(2000)
  })

  test("validates actor context token budget", () => {
    const settings = defaultSettings()
    settings.providers.openai.apiKey = "unit-test-api-key"
    settings.roles.actor.contextTokenBudget = 0

    expect(() => validateSettings(settings)).toThrow("contextTokenBudget for actor must be a positive integer.")
  })

  test("migrates coordinator settings to actor settings", () => {
    const settings = normalizeSettings({
      coordinator: {
        provider: "anthropic",
        model: "coordinator-model",
        apiKey: "coordinator-key",
        temperature: 0.3,
        maxTokens: 1234,
        timeoutSeconds: 45,
      },
    } as Parameters<typeof normalizeSettings>[0])

    expect(settings.roles.actor.model).toBe("coordinator-model")
    expect(settings.providers.anthropic.apiKey).toBe("coordinator-key")
  })

  test("promotes the first legacy provider connection", () => {
    const settings = normalizeSettings({
      storyBuilder: {
        provider: "lmstudio",
        model: "story-model",
        apiKey: "first-key",
        baseUrl: "http://first.test/v1",
        temperature: 0.3,
        maxTokens: 1000,
        timeoutSeconds: 30,
      },
      planner: {
        provider: "lmstudio",
        model: "planner-model",
        apiKey: "second-key",
        baseUrl: "http://second.test/v1",
        temperature: 0.3,
        maxTokens: 1000,
        timeoutSeconds: 30,
      },
    } as Parameters<typeof normalizeSettings>[0])

    expect(settings.providers.lmstudio.apiKey).toBe("first-key")
    expect(settings.providers.lmstudio.baseUrl).toBe("http://first.test/v1")
    expect(settings.roles.planner.model).toBe("planner-model")
  })

  test("supports Gemini settings", () => {
    const settings = defaultSettings()
    settings.providers.gemini.apiKey = "google-key"
    for (const role of Object.keys(settings.roles) as Array<keyof typeof settings.roles>) {
      settings.roles[role].provider = "gemini"
      settings.roles[role].model = "gemini-2.5-pro"
    }

    expect(() => validateSettings(settings)).not.toThrow()
  })

  test("allows OpenAI-compatible local providers without API keys", () => {
    const settings = defaultSettings()
    settings.providers.ollama.apiKey = ""
    settings.providers.ollama.baseUrl = "http://localhost:11434/v1"
    for (const role of Object.keys(settings.roles) as Array<keyof typeof settings.roles>) {
      settings.roles[role].provider = "ollama"
      settings.roles[role].model = "llama3.1"
    }

    expect(() => validateSettings(settings)).not.toThrow()
  })

  test("requires base URL for OpenAI-compatible providers", () => {
    const settings = defaultSettings()
    settings.providers.vllm.apiKey = ""
    settings.providers.vllm.baseUrl = ""
    for (const role of Object.keys(settings.roles) as Array<keyof typeof settings.roles>) {
      settings.roles[role].provider = "vllm"
      settings.roles[role].model = "local-model"
    }

    expect(() => validateSettings(settings)).toThrow("Base URL is required")
  })

  test("fills provider defaults while normalizing settings", () => {
    const settings = normalizeSettings({
      actor: {
        provider: "lmstudio",
        model: "local-model",
        temperature: 0.4,
        maxTokens: 4096,
        timeoutSeconds: 60,
      },
    } as Parameters<typeof normalizeSettings>[0])

    expect(settings.providers.lmstudio.baseUrl).toBe("http://localhost:1234/v1")
    expect(resolveRoleSettings(settings, "actor").reasoningEffort).toBe("medium")
  })
})
