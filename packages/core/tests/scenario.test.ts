import { describe, expect, test } from "bun:test"
import {
  parseScenarioDocument,
  validateSettings,
  defaultSettings,
  normalizeSettings,
  plannerDigestSummary,
  compactLines,
  compactText,
  renderPromptLanguageGuide,
  renderOutputLengthGuide,
  resolveActorContextTokenBudget,
  resolveRoleSettings,
  scalePromptLimit,
} from "../src"
import { actorPrompts } from "../src/simulation/roles/actor/prompts"
import { isValidActorAction, isValidActorTarget } from "../src/simulation/roles/actor/state"
import { actorCardPrompts } from "../src/simulation/roles/generator/card-prompts"
import { coordinatorPrompts } from "../src/simulation/roles/coordinator/prompts"
import { buildRepairChoicePrompt } from "../src/simulation/roles/repair"
import type { ActorGraphState } from "../src/simulation/roles/actor"
import { initialActorCardState } from "../src/simulation/roles/generator/card-state"
import { parseActorRoster, renderRosterPrompt } from "../src/simulation/roles/generator/roster"
import type { WorkflowState } from "../src/simulation/state"
import type { SimulationState } from "@simula/shared"

describe("scenario parsing", () => {
  test("parses frontmatter controls and body", () => {
    const scenario = parseScenarioDocument(`---\nnum_cast: 3\nallow_additional_cast: false\n---\nA crisis unfolds.`)

    expect(scenario.controls).toEqual({ numCast: 3, allowAdditionalCast: false, actionsPerType: 3, maxRound: 8, fastMode: false, outputLength: "short" })
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

  test("parses output length from frontmatter", () => {
    const scenario = parseScenarioDocument(
      `---\nnum_cast: 2\noutput_length: medium\n---\nA crisis unfolds.`
    )

    expect(scenario.controls.outputLength).toBe("medium")
  })

  test("rejects unsupported output length", () => {
    expect(() => parseScenarioDocument(`---\nnum_cast: 2\noutput_length: huge\n---\nA crisis unfolds.`)).toThrow(
      "output_length must be short, medium, or long"
    )
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

  test("parses semicolon actor roster", () => {
    expect(parseActorRoster("도널드 트럼프 미국 대통령: 미국 대통령; JD 밴스와 백악관 협상 라인: 협상 라인", 2)).toEqual([
      { index: 1, name: "도널드 트럼프 미국 대통령", roleSeed: "미국 대통령" },
      { index: 2, name: "JD 밴스와 백악관 협상 라인", roleSeed: "협상 라인" },
    ])
  })

  test("keeps roster prompt on exact scenario names", () => {
    const prompt = renderRosterPrompt(
      2,
      "Planner digest.",
      "도널드 트럼프 미국 대통령과 JD 밴스와 백악관 협상 라인이 충돌한다."
    )

    expect(prompt).toContain("<name>: <short role>; <name>: <short role>")
    expect(prompt).toContain("Use exact person, organization, or line names")
    expect(prompt).toContain("authoritative actor candidates")
    expect(prompt).toContain("places, meetings, channels")
    expect(prompt).toContain("Do not invent Korean names")
    expect(prompt).toContain("도널드 트럼프 미국 대통령")
  })

  test("keeps named actor section in roster prompt", () => {
    const scenario = [
      "Context before actors. ".repeat(120),
      "## 주요 등장 인물",
      "- 도널드 트럼프 미국 대통령: 예측불가 압박을 극대화한다.",
      "- JD 밴스와 백악관 협상 라인: 최종 제안과 봉쇄 완화를 조율한다.",
      "- 혁명수비대와 해상·프록시 라인: 해협 교란과 우회 압박을 검토한다.",
      "## 압력과 전환점",
      "- 이슬라마바드 고위급 협상은 결렬된 절차이지 actor가 아니다.",
    ].join("\n")

    const prompt = renderRosterPrompt(3, "Planner digest.", scenario)

    expect(prompt).toContain("혁명수비대와 해상·프록시 라인")
    expect(prompt).toContain("이슬라마바드 고위급 협상은 결렬된 절차")
  })

  test("rejects duplicate actor roster names", () => {
    expect(() => parseActorRoster("1. Dana - Channel lead\n2. Dana - Consumer advocate", 2)).toThrow(
      "duplicate actor name"
    )
  })

  test("requires exact actor and action ids for actor choices", () => {
    const state = buildActorChoiceState()

    expect(actorPrompts.target(state, { thought: "Pressure is visible." })).toContain("- actor-2")
    expect(actorPrompts.target({ ...state, scenario: { ...state.scenario, controls: { ...state.scenario.controls, outputLength: "long" } } }, { thought: "Pressure is visible." })).not.toContain("detailed")
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

  test("compacts long prompt inputs", () => {
    expect(compactText("alpha ".repeat(300), 80).length).toBeLessThanOrEqual(80)
    expect(compactLines(["one", "two", "three", "four"], 2, 40)).toBe("three\nfour")
    expect(compactLines(["alpha ".repeat(50), "beta ".repeat(50)], 2, 90).length).toBeLessThanOrEqual(90)
  })

  test("scales prompt length guide by output length", () => {
    expect(renderOutputLengthGuide({ outputLength: "short" })).toContain("concise")
    expect(renderOutputLengthGuide({ outputLength: "medium" })).toContain("moderate")
    expect(renderOutputLengthGuide({ outputLength: "long" })).toContain("detailed")
    expect(scalePromptLimit(100, { outputLength: "short" })).toBe(100)
    expect(scalePromptLimit(100, { outputLength: "medium" })).toBe(150)
    expect(scalePromptLimit(100, { outputLength: "long" })).toBe(200)
  })

  test("keeps actor card background prompt on planner digest", () => {
    const simulation = buildDigestSimulation()
    const prompt = actorCardPrompts.backgroundHistory(
      initialActorCardState({
        runId: "digest-run",
        scenario: simulation.scenario,
        settings: defaultSettings(),
        actorIndex: 1,
        assignedName: "Actor 1",
        roleSeed: "Primary decision maker",
        fullRoster: [
          { index: 1, name: "Actor 1", roleSeed: "Primary decision maker" },
          { index: 2, name: "Actor 2", roleSeed: "External stakeholder" },
        ],
        plannerDigest: plannerDigestSummary(simulation.plan, simulation.scenario.text),
        emit: async () => {},
      })
    )

    expect(prompt).not.toContain("Roster:")
    expect(prompt).not.toContain("Actor 2")
    expect(prompt).toContain("Planner scenario digest")
    expect(prompt).toContain("Actor pressures: Stakeholders face cost.")
  })

  test("actor thought uses compact digest instead of the full scenario body", () => {
    const state = buildActorChoiceState()
    const scenarioMarker = "FULL_SCENARIO_BODY_SHOULD_NOT_BE_INCLUDED"
    const prompt = actorPrompts.thought({
      ...state,
      scenario: {
        ...state.scenario,
        text: `${scenarioMarker} ${"long ".repeat(200)}`,
      },
      plannerDigest: "Compact digest for actor reasoning.",
    }, {})

    expect(prompt).toContain("Compact digest for actor reasoning.")
    expect(prompt).not.toContain(scenarioMarker)
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
    expect(defaultSettings().roles.actor.contextTokenBudget).toBe(400)
  })

  test("validates actor context token budget", () => {
    const settings = defaultSettings()
    settings.providers.openai.apiKey = "unit-test-api-key"
    settings.roles.actor.contextTokenBudget = 0

    expect(() => validateSettings(settings)).toThrow("contextTokenBudget for actor must be a positive integer.")
  })

  test("caps actor context token budget for compact prompts", () => {
    const settings = defaultSettings()
    settings.roles.actor.contextTokenBudget = 1200

    expect(resolveActorContextTokenBudget({
      text: "A crisis unfolds.",
      controls: { numCast: 2, actionsPerType: 3, maxRound: 8, fastMode: false, allowAdditionalCast: true },
    }, settings)).toBe(400)
    expect(resolveActorContextTokenBudget({
      text: "A crisis unfolds.",
      controls: { numCast: 2, actionsPerType: 3, maxRound: 8, fastMode: false, allowAdditionalCast: true, actorContextTokenBudget: 1200 },
    }, settings)).toBe(400)
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
