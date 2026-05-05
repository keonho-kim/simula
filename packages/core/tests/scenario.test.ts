import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import {
  parseScenarioDocument,
  validateSettings,
  defaultSettings,
  normalizeSettings,
  plannerDigestSummary,
  compactLines,
  compactText,
  renderPromptLanguageGuide,
  renderPromptReasoningGuide,
  renderOutputLengthGuide,
  renderStoryBuilderChangeSummaryPrompt,
  renderStoryBuilderPrompt,
  resolveRoleSettings,
  scalePromptLimit,
  listScenarioSamples,
  streamDraftScenario,
  storyBuilderFallbackDraft,
  withRolePromptGuide,
} from "../src"
import { buildExactChoiceSettings, exactChoiceMessages, reasoningOnlyWarning } from "../src/llm"
import { readUsage } from "../src/llm/usage"
import { actorMemorySentenceLimit, renderActorMemoryLengthGuide } from "../src/simulation/actor-memory"
import { emitModelTelemetry } from "../src/simulation/events"
import { actorPrompts } from "../src/simulation/roles/actor/prompts"
import { buildActorDecision, isValidActorAction, isValidActorTarget } from "../src/simulation/roles/actor/state"
import { actorCardPrompts } from "../src/simulation/roles/generator/card-prompts"
import { coordinatorPrompts } from "../src/simulation/roles/coordinator/prompts"
import { eventInjectionAllowedOutputs } from "../src/simulation/event-injection"
import { buildRepairChoicePrompt } from "../src/simulation/roles/repair"
import type { ActorGraphState } from "../src/simulation/roles/actor"
import { initialActorCardState } from "../src/simulation/roles/generator/card-state"
import { parseActorRoster, renderRosterPrompt } from "../src/simulation/roles/generator/roster"
import type { WorkflowState } from "../src/simulation/state"
import type { PlannedEvent, SimulationState } from "@simula/shared"

describe("scenario parsing", () => {
  test("parses frontmatter controls and body", () => {
    const scenario = parseScenarioDocument(`---\nnum_cast: 3\nallow_additional_cast: false\n---\nA crisis unfolds.`)

    expect(scenario.controls).toEqual({ numCast: 3, allowAdditionalCast: false, actionsPerType: 3, maxRound: 8, fastMode: false, outputLength: "short", loadLevel: "middle" })
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

  test("rejects actor context token budget frontmatter", () => {
    expect(() =>
      parseScenarioDocument(`---\nnum_cast: 2\nactor_context_token_budget: 1200\n---\nA crisis unfolds.`)
    ).toThrow("Unsupported scenario control: actor_context_token_budget")
  })

  test("parses output length from frontmatter", () => {
    const scenario = parseScenarioDocument(
      `---\nnum_cast: 2\noutput_length: medium\n---\nA crisis unfolds.`
    )

    expect(scenario.controls.outputLength).toBe("medium")
  })

  test("parses load level from frontmatter", () => {
    for (const loadLevel of ["low", "middle", "high"] as const) {
      const scenario = parseScenarioDocument(
        `---\nnum_cast: 2\nload_level: ${loadLevel}\n---\nA crisis unfolds.`
      )

      expect(scenario.controls.loadLevel).toBe(loadLevel)
    }
  })

  test("defaults missing load level to middle", () => {
    const scenario = parseScenarioDocument(`---\nnum_cast: 2\n---\nA crisis unfolds.`)

    expect(scenario.controls.loadLevel).toBe("middle")
  })

  test("rejects unsupported load level", () => {
    expect(() => parseScenarioDocument(`---\nnum_cast: 2\nload_level: medium\n---\nA crisis unfolds.`)).toThrow(
      "load_level must be low, middle, or high"
    )
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

  test("loads all scenario samples with load levels", async () => {
    const samples = await listScenarioSamples(join(process.cwd(), "senario.samples"))
    const sampleNames = new Set(samples.map((sample) => sample.name))

    expect(samples.every((sample) => ["low", "middle", "high"].includes(sample.controls.loadLevel ?? ""))).toBe(true)
    expect(sampleNames).toEqual(new Set([
      "01_consumer_marketing_launch.md",
      "02_wargame_iran_us.md",
      "03_startup_boardroom_crisis.md",
      "04_city_hall_disaster_response.md",
      "05_korean_enterprise_promo_approval_conflict.md",
      "06_new_technology_internal_conflict.md",
      "07_relationship_triangle_conflict.md",
      "08_family_clinic_care_decision.md",
      "09_apartment_redevelopment_committee.md",
      "10_regional_bank_social_media_run.md",
      "11_airport_weather_disruption_command.md",
      "12_hospital_network_ransomware_coordination.md",
    ]))
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
      },
      roundIndex: 1,
      coordinatorTrace: {
        role: "coordinator",
        runtimeFrame: "Coordinate pressure.",
        actorRouting: "Route all actors.",
        interactionPolicy: "Respect visibility boundaries.",
        outcomeDirection: "Advance the conflict.",
        eventInjection: "",
        eventResolution: "",
        progressDecision: "",
        extensionDecision: "",
        retryCounts: {
          runtimeFrame: 0,
          actorRouting: 0,
          interactionPolicy: 0,
          outcomeDirection: 0,
          eventInjection: 0,
          eventResolution: 0,
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
    expect(prompt).toContain("speaking-capable decision maker")
    expect(prompt).toContain("Never use products, product lines, promotions")
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

  test("keeps partial events available for coordinator injection", () => {
    const events = [
      plannedEvent("event-1", "pending"),
      plannedEvent("event-2", "partial"),
      plannedEvent("event-3", "completed"),
    ]
    const state = buildCoordinatorPromptState(events)
    const prompt = coordinatorPrompts.eventInjection(state, {})

    expect(eventInjectionAllowedOutputs(events)).toEqual(["event-1", "event-2", "None"])
    expect(prompt).toContain("- event-1 (pending): Event 1.")
    expect(prompt).toContain("- event-2 (partial): Event 2.")
    expect(prompt).not.toContain("event-3")
  })

  test("asks coordinator to resolve injected events as completed or partial", () => {
    const state = buildCoordinatorPromptState([plannedEvent("event-1", "active")])
    state.simulation.roundDigests = [{
      roundIndex: 1,
      preRound: { elapsedTime: "Opening", content: "Injected event." },
      injectedEventId: "event-1",
    }]
    state.simulation.interactions = [{
      id: "interaction-1",
      roundIndex: 1,
      sourceActorId: "actor-1",
      targetActorIds: [],
      actionType: "actor-1-public-1",
      content: "Actor 1 deferred responsibility.",
      eventId: "event-1",
      visibility: "public",
      decisionType: "action",
      intent: "Delay commitment.",
      expectation: "Pressure remains.",
    }]

    const prompt = coordinatorPrompts.eventResolution(state, {})

    expect(prompt).toContain("Return exactly one allowed output: completed or partial")
    expect(prompt).toContain("Use completed only when")
    expect(prompt).toContain("Use partial when")
    expect(prompt).toContain("event-1: Event 1.")
    expect(prompt).toContain("Actor 1 deferred responsibility.")
  })

  test("blocks coordinator completion guidance while events are unresolved", () => {
    const state = buildCoordinatorPromptState([plannedEvent("event-1", "partial")])
    state.simulation.roundDigests = [{
      roundIndex: 1,
      preRound: { elapsedTime: "Opening", content: "Injected event." },
      injectedEventId: "event-1",
    }]

    const prompt = coordinatorPrompts.progressDecision(state, {})

    expect(prompt).toContain("Use complete only when there are no unresolved pending or partial events.")
    expect(prompt).toContain("Unresolved events:")
    expect(prompt).toContain("- event-1 (partial): Event 1.")
  })

  test("rejects duplicate actor roster names", () => {
    expect(() => parseActorRoster("1. Dana - Channel lead\n2. Dana - Consumer advocate", 2)).toThrow(
      "duplicate actor name"
    )
  })

  test("requires exact actor and action ids for actor choices", () => {
    const state = buildActorChoiceState()
    const actionState = {
      ...state,
      trace: { ...state.trace, action: "actor-1-public-1" },
    }
    const noActionState = {
      ...state,
      trace: { ...state.trace, action: "no_action" },
    }

    const targetPrompt = actorPrompts.target(state, { thought: "Pressure is visible.", action: "actor-1-public-1" })
    const allowedTargetOutputs = targetPrompt.split("Allowed outputs:\n")[1]?.split("\nTarget context:")[0]

    expect(allowedTargetOutputs).toBe("- actor-2")
    expect(targetPrompt).toContain("Target context:\nactor-2: Actor 2")
    expect(allowedTargetOutputs).not.toContain("Target history.")
    expect(actorPrompts.target({ ...state, scenario: { ...state.scenario, controls: { ...state.scenario.controls, outputLength: "long" } } }, { thought: "Pressure is visible.", action: "actor-1-public-1" })).not.toContain("detailed")
    expect(actorPrompts.action(state, { thought: "Pressure is visible." })).toContain("- actor-1-public-1")
    expect(isValidActorTarget("actor-2", actionState)).toBe(true)
    expect(isValidActorTarget("None", actionState)).toBe(false)
    expect(isValidActorTarget("None", noActionState)).toBe(true)
    expect(isValidActorTarget("Actor 2", actionState)).toBe(false)
    expect(isValidActorTarget("actor-2.", actionState)).toBe(false)
    expect(isValidActorTarget("none", noActionState)).toBe(false)
    expect(isValidActorAction("actor-1-public-1", state)).toBe(true)
    expect(isValidActorAction("no_action", state)).toBe(true)
    expect(isValidActorAction("Public move 1", state)).toBe(false)
    expect(isValidActorAction("None", state)).toBe(false)
  })

  test("guides actor choices toward realistic access paths", () => {
    const state = buildActorChoiceState()
    const actionPrompt = actorPrompts.action(state, { thought: "Pressure is visible." })
    const targetPrompt = actorPrompts.target(state, { thought: "Pressure is visible.", action: "actor-1-public-1" })

    expect(actionPrompt).toContain("channels this actor can realistically use")
    expect(actionPrompt).toContain("Do not jump to private or semi-public contact")
    expect(targetPrompt).toContain("realistic access path")
    expect(targetPrompt).toContain("Avoid unrealistic leaps")
    expect(targetPrompt).not.toContain("If direct contact would be awkward")
    expect(targetPrompt).toContain("Return exactly one allowed output from Allowed outputs")
    expect(targetPrompt).toContain("Target context:\nactor-2: Actor 2")
    expect(targetPrompt).toContain("Target history.")
  })

  test("keeps no-action silent and preserves targets for real actions", () => {
    const state = buildActorChoiceState()
    const noAction = buildActorDecision({
      ...state,
      trace: {
        ...state.trace,
        action: "no_action",
        target: "actor-2",
        intent: "Hold position.",
        message: "We need to talk.",
      },
    })

    expect(noAction.decisionType).toBe("no_action")
    expect(noAction.targetActorIds).toEqual([])
    expect(noAction.message).toBeUndefined()

    const action = buildActorDecision({
      ...state,
      trace: {
        ...state.trace,
        action: "actor-1-public-1",
        target: "actor-2",
        intent: "Push the issue.",
        message: "We need a concrete answer now.",
      },
    })

    expect(action.decisionType).toBe("action")
    expect(action.targetActorIds).toEqual(["actor-2"])
    expect(action.message).toBe("We need a concrete answer now.")
  })

  test("keeps internal actor and action ids out of actor visible text", () => {
    const state = buildActorChoiceState()
    const prompt = actorPrompts.intent(state, {
      target: "actor-2",
      action: "actor-1-public-1",
    })

    expect(prompt).toContain("Target: actor-2 (Actor 2")
    expect(prompt).toContain("Action: actor-1-public-1 (public, Public move 1)")
    expect(prompt).toContain("use actor names and action labels")

    const decision = buildActorDecision({
      ...state,
      trace: {
        ...state.trace,
        action: "actor-1-public-1",
        target: "actor-2",
        intent: "Confirm actor-2 through actor-1-public-1.",
        message: "I will use actor-1-public-1 with actor-2.",
      },
    })

    expect(decision.targetActorIds).toEqual(["actor-2"])
    expect(decision.actionId).toBe("actor-1-public-1")
    expect(decision.intent).toBe("Confirm Actor 2 through Public move 1.")
    expect(decision.message).toBe("I will use Public move 1 with Actor 2.")
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

  test("maps actor memory compression length to output length", () => {
    expect(actorMemorySentenceLimit({ outputLength: "short" })).toBe(3)
    expect(actorMemorySentenceLimit({ outputLength: "medium" })).toBe(5)
    expect(actorMemorySentenceLimit({ outputLength: "long" })).toBe(10)
    expect(renderActorMemoryLengthGuide({ outputLength: "medium" })).toBe(
      "Return at most 5 short first-person sentences."
    )
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

describe("story builder", () => {
  test("renders sample-shaped fallback drafts", () => {
    const draft = storyBuilderFallbackDraft([
      { role: "user", content: "A hospital board delays a risky emergency expansion." },
    ])

    expect(draft).toContain("# Scenario Draft")
    expect(draft).toContain("## Purpose and End Condition")
    expect(draft).toContain("## Core Situation")
    expect(draft).toContain("## Key Actors")
    expect(draft).toContain("## Channels")
    expect(draft).toContain("## Immediate Action Units")
    expect(draft).toContain("## Behavioral Realism Rules")
    expect(draft).toContain("A hospital board delays a risky emergency expansion.")
  })

  test("instructs StoryBuilder to revise with conversation context", () => {
    const prompt = renderStoryBuilderPrompt({
      messages: [
        { role: "user", content: "A city council faces a controversial infrastructure vote." },
        { role: "assistant", content: "# Scenario Draft\n\n## Core Situation\n- First draft." },
        { role: "user", content: "Make the finance pressure sharper." },
      ],
      controls: {
        numCast: 5,
        allowAdditionalCast: false,
        actionsPerType: 2,
        maxRound: 6,
        fastMode: false,
        outputLength: "short",
      },
      language: "en",
    })

    expect(prompt).toContain("same structure as Simula sample scenario files")
    expect(prompt).toContain("Do not include YAML frontmatter")
    expect(prompt).toContain("Cast: 5")
    expect(prompt).toContain("Max rounds: 6")
    expect(prompt).toContain("Actions per visibility: 2")
    expect(prompt).toContain("Assistant: # Scenario Draft")
    expect(prompt).toContain("User: Make the finance pressure sharper.")
  })

  test("streams initial drafts without a change summary", async () => {
    const settings = defaultSettings()
    settings.providers.openai.apiKey = "unit-test-api-key"
    const events = []
    for await (const event of streamDraftScenario(
      {
        messages: [{ role: "user", content: "A council debates a flood wall." }],
        controls: {
          numCast: 4,
          allowAdditionalCast: true,
          actionsPerType: 3,
          maxRound: 8,
          fastMode: false,
          outputLength: "short",
        },
      },
      settings,
      {
        invokeText: async () => "# Scenario Draft\n\n## Core Situation\n- Flood wall conflict.",
      }
    )) {
      events.push(event)
    }

    expect(events.some((event) => event.type === "draft")).toBe(true)
    expect(events.some((event) => event.type === "summary")).toBe(false)
    expect(events.filter((event) => event.type === "progress").map((event) => event.stage)).toEqual([
      "draft",
      "draft",
    ])
  })

  test("streams revised drafts before the reflected change summary", async () => {
    const settings = defaultSettings()
    settings.providers.openai.apiKey = "unit-test-api-key"
    const events = []
    for await (const event of streamDraftScenario(
      {
        messages: [
          { role: "user", content: "A council debates a flood wall." },
          { role: "assistant", content: "# Scenario Draft\n\n## Core Situation\n- First draft." },
          { role: "user", content: "Make the finance pressure sharper." },
        ],
        controls: {
          numCast: 4,
          allowAdditionalCast: true,
          actionsPerType: 3,
          maxRound: 8,
          fastMode: false,
          outputLength: "short",
        },
      },
      settings,
      {
        invokeText: async () => "# Scenario Draft\n\n## Core Situation\n- Finance pressure is sharper.",
        streamText: async (_prompt, onDelta) => {
          await onDelta("Sharpened finance ")
          await onDelta("pressure.")
          return "Sharpened finance pressure."
        },
      }
    )) {
      events.push(event)
    }

    expect(events.map((event) => event.type)).toEqual([
      "progress",
      "draft",
      "progress",
      "progress",
      "summary_delta",
      "summary_delta",
      "summary",
      "progress",
    ])
    expect(events.find((event) => event.type === "draft")).toEqual({
      type: "draft",
      text: "# Scenario Draft\n\n## Core Situation\n- Finance pressure is sharper.",
    })
    expect(
      events
        .filter((event) => event.type === "summary_delta")
        .map((event) => event.content)
        .join("")
    ).toBe("Sharpened finance pressure.")
  })

  test("renders a prompt for reflected change summaries", () => {
    const prompt = renderStoryBuilderChangeSummaryPrompt(
      {
        messages: [
          { role: "user", content: "A council debates a flood wall." },
          { role: "assistant", content: "# Scenario Draft\n\n## Core Situation\n- First draft." },
          { role: "user", content: "Make the finance pressure sharper." },
        ],
        controls: {
          numCast: 4,
          allowAdditionalCast: true,
          actionsPerType: 3,
          maxRound: 8,
          fastMode: false,
          outputLength: "short",
        },
      },
      "# Scenario Draft\n\n## Core Situation\n- Finance pressure is sharper."
    )

    expect(prompt).toContain("Latest user request:")
    expect(prompt).toContain("Make the finance pressure sharper.")
    expect(prompt).toContain("Previous draft:")
    expect(prompt).toContain("First draft.")
    expect(prompt).toContain("Revised draft:")
    expect(prompt).toContain("Finance pressure is sharper.")
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

function buildCoordinatorPromptState(events: PlannedEvent[]): WorkflowState {
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

function plannedEvent(id: string, status: PlannedEvent["status"]): PlannedEvent {
  return {
    id,
    title: `Event ${id.replace("event-", "")}`,
    summary: `Summary for ${id}.`,
    status,
    participantIds: ["actor-1"],
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
      extensionDecision: "",
      retryCounts: {
        runtimeFrame: 0,
        actorRouting: 0,
        interactionPolicy: 0,
        outcomeDirection: 0,
        eventInjection: 0,
        eventResolution: 0,
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
  })

  test("drops removed actor context token budget settings", () => {
    const settings = normalizeSettings({
      roles: {
        actor: {
          provider: "openai",
          model: "actor-model",
          temperature: 0.4,
          maxTokens: 1000,
          timeoutSeconds: 60,
          contextTokenBudget: 2000,
        },
      },
    } as Parameters<typeof normalizeSettings>[0])

    expect("contextTokenBudget" in settings.roles.actor).toBe(false)
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
    expect(resolveRoleSettings(settings, "actor").reasoningEffort).toBeUndefined()
  })

  test("preserves explicitly configured reasoning effort", () => {
    const settings = normalizeSettings({
      actor: {
        provider: "lmstudio",
        model: "local-model",
        temperature: 0.4,
        maxTokens: 4096,
        timeoutSeconds: 60,
        reasoningEffort: "medium",
      },
    } as Parameters<typeof normalizeSettings>[0])

    expect(resolveRoleSettings(settings, "actor").reasoningEffort).toBe("medium")
  })

  test("builds exact-choice settings without reasoning controls", () => {
    const settings = normalizeSettings({
      actor: {
        provider: "lmstudio",
        model: "local-model",
        temperature: 0.4,
        maxTokens: 4096,
        timeoutSeconds: 60,
        reasoningEffort: "medium",
        extraBody: { reasoning_effort: "medium", seed: 7 },
      },
    } as Parameters<typeof normalizeSettings>[0])

    const exact = buildExactChoiceSettings(settings, "actor")

    expect(exact.temperature).toBe(0)
    expect(exact.maxTokens).toBe(64)
    expect(exact.reasoningEffort).toBeUndefined()
    expect(exact.extraBody).toEqual({ seed: 7, reasoning_effort: "none" })
    expect(resolveRoleSettings(settings, "actor").reasoningEffort).toBe("medium")
  })

  test("builds exact-choice chat messages", () => {
    const messages = exactChoiceMessages("Choose one.", ["actor-1-public-1", "no_action"])

    expect(messages).toEqual([
      expect.objectContaining({ role: "system" }),
      expect.objectContaining({ role: "user" }),
    ])
    expect(JSON.stringify(messages)).toContain("Do not reason")
    expect(JSON.stringify(messages)).toContain("- actor-1-public-1")
    expect(JSON.stringify(messages)).toContain("assistant content")
    expect(JSON.stringify(messages)).not.toContain("thinking phase")
  })

  test("renders reasoning guide from configured effort", () => {
    expect(renderPromptReasoningGuide(undefined)).toBe("")
    expect(renderPromptReasoningGuide("low")).toContain("within 5 short sentences")
    expect(renderPromptReasoningGuide("medium")).toContain("within 10 short sentences")
    expect(renderPromptReasoningGuide("high")).toContain("within 3 compact paragraphs")
  })

  test("adds reasoning guide only to role-aware prompts", () => {
    const settings = defaultSettings()
    settings.roles.observer.reasoningEffort = "medium"

    const prompt = withRolePromptGuide("Summarize the round.", {
      language: "en",
      settings,
      role: "observer",
    })

    expect(prompt).toContain("Language: English")
    expect(prompt).toContain("within 10 short sentences")
    expect(prompt).toContain("Summarize the round.")
    expect(withRolePromptGuide("Summarize the round.", { language: "en", settings, role: "actor" })).not.toContain(
      "thinking phase"
    )
  })

  test("diagnoses reasoning-only responses", () => {
    const warning = reasoningOnlyWarning({
      text: "",
      metrics: {
        role: "actor",
        step: "action",
        attempt: 1,
        ttftMs: 1,
        durationMs: 2,
        inputTokens: 1,
        reasoningTokens: 64,
        outputTokens: 64,
        totalTokens: 65,
        tokenSource: "provider",
      },
      diagnostics: { reasoningContentObserved: true, reasoningContent: "thinking", finishReason: "length" },
    })

    expect(warning).toContain("completion budget was exhausted")
  })

  test("reads reasoning token usage from provider metadata", () => {
    expect(readUsage({
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
      output_token_details: { reasoning: 7 },
    })?.reasoningTokens).toBe(7)
    expect(readUsage({
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
      completion_tokens_details: { reasoning_tokens: 8 },
    })?.reasoningTokens).toBe(8)
    expect(readUsage({
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
      output_tokens_details: { reasoning_tokens: 9 },
    })?.reasoningTokens).toBe(9)
  })

  test("emits reasoning telemetry when provider reports reasoning tokens", async () => {
    const events: Array<{ type: string; content?: string }> = []
    await emitModelTelemetry("run-1", {
      text: "final",
      metrics: {
        role: "observer",
        step: "roundSummary",
        attempt: 1,
        ttftMs: 1,
        durationMs: 2,
        inputTokens: 10,
        reasoningTokens: 5,
        outputTokens: 20,
        totalTokens: 30,
        tokenSource: "provider",
      },
      diagnostics: { reasoningContentObserved: false, reasoningContent: "" },
    }, async (event) => {
      events.push({ type: event.type, content: event.type === "model.reasoning" ? event.content : undefined })
    })

    expect(events.map((event) => event.type)).toEqual(["model.metrics", "model.reasoning"])
    expect(events[1]?.content).toContain("not provided")
  })
})
