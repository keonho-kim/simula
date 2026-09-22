/**
 * Purpose: Verify planner, coordinator, generator, and prompt compaction contracts.
 * Pattern: Prompt contract test.
 * Usage: Executed by bun test.
 * Related: src/backend/core/prompts/prompt.ts, src/backend/core/simulation/roles/coordinator/prompts.ts
 */
import { describe, expect, test } from "bun:test"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { plannerDigestSummary } from "@/backend/core/simulation/planning/digest"
import { renderPromptLanguageGuide } from "@/backend/core/prompts/language"
import { actorCardPrompts } from "@/backend/core/simulation/roles/generator/cards/prompts"
import { actorPrompts } from "@/backend/core/simulation/roles/actor/prompts"
import { coordinatorPrompts } from "@/backend/core/simulation/roles/coordinator/prompts"
import { eventInjectionAllowedOutputs } from "@/backend/core/simulation/events/injection"
import { initialActorCardState } from "@/backend/core/simulation/roles/generator/cards/state"
import { parseActorRoster, renderRosterPrompt } from "@/backend/core/simulation/roles/generator/roster"
import type { ActorGraphState } from "@/backend/core/simulation/roles/actor"
import type { WorkflowState } from "@/backend/core/simulation/workflow/state"
import { buildCoordinatorPromptState, buildDigestSimulation, plannedEvent } from "./scenario-fixtures"

describe("prompt contracts", () => {
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
})
