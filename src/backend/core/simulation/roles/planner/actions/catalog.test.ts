import { expect, spyOn, test } from "bun:test"
import type { RunEvent } from "@/shared"
import * as invocation from "@/backend/integrations/llm/invoke"
import { parseScenarioDocument } from "@/backend/core/scenario"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { initialSimulationState } from "@/backend/core/simulation/workflow/state"
import { buildActor } from "@/backend/core/simulation/roles/generator/state"
import { actionAllowedOutputs, buildActorDecision, createActorGraphState, isValidActorAction, targetAllowedOutputs } from "@/backend/core/simulation/roles/actor/state"
import { emptyCoordinatorTrace } from "@/backend/core/simulation/roles/coordinator/state"
import { buildInteraction } from "@/backend/core/simulation/actors/interactions"
import { parseActionBatch } from "./catalog"
import { createPlannerActionsNode } from "./node"

const rows = "근거 요청 | 정보가 부족할 때 | 판단 자료를 확보한다\n대안 제안 | 기존 방안이 막혔을 때 | 선택지를 늘린다"
const scenario = { ...parseScenarioDocument("---\nnum_cast: 2\nactions_per_type: 4\n---\n출시를 논의하는 팀"), language: "ko" as const }
const event = { id: "event-1", title: "회의", summary: "출시 논의", status: "pending" as const, participantIds: [] }

function state() {
  const simulation = initialSimulationState("run", scenario)
  return { runId: "run", scenario, settings: defaultSettings(), simulation: { ...simulation, plan: { interpretation: "팀의 출시 논의", backgroundStory: "팀의 출시 논의", actionCatalog: {}, majorEvents: [event] } } }
}

test("program-assigned codes retain Korean labels and concrete action metadata", () => {
  const actions = parseActionBatch(rows, "public", 0, 2, {}, "ko")
  expect(actions.map((action) => action.id)).toEqual(["PUB01", "PUB02"])
  expect(actions[0]).toEqual({ id: "PUB01", visibility: "public", label: "근거 요청", intentHint: "정보가 부족할 때", expectedOutcome: "판단 자료를 확보한다" })
  expect(parseActionBatch("```text\n1. 자료 검토 | 근거가 필요할 때 | 판단을 준비한다\n```", "solitary", 3, 1, {}, "ko")[0]!.id).toBe("SOL04")
})

test("invalid batches are rejected instead of silently changing the action catalog", () => {
  const existing = { PUB01: parseActionBatch(rows, "public", 0, 2, {}, "ko")[0]! }
  expect(() => parseActionBatch(rows, "public", 0, 3, {}, "ko")).toThrow("Expected 3")
  expect(() => parseActionBatch("근거 요청 | 정보가 부족할 때", "public", 0, 1, {}, "ko")).toThrow("exactly")
  expect(() => parseActionBatch("근거 요청 1 | 정보가 부족할 때 | 근거를 얻는다\n근거 요청 2 | 검토할 때 | 근거를 얻는다", "public", 0, 2, {}, "ko")).toThrow("distinct")
  expect(() => parseActionBatch(rows, "private", 0, 2, existing, "ko")).toThrow("distinct")
  expect(() => parseActionBatch("PUB01 | Need evidence | Learn facts", "public", 0, 1, {}, "en")).toThrow("not a code")
  expect(() => parseActionBatch("Request evidence | Need evidence | Learn facts", "public", 0, 1, {}, "ko")).toThrow("Korean")
  expect(() => parseActionBatch("Public move 1 about a goal | Need evidence | Learn facts", "public", 0, 1, {}, "en")).toThrow("concrete")
})

test("Actor selects a code; labels, scope, effect and interaction metadata come from the catalog", () => {
  const actions = [...parseActionBatch(rows, "public", 0, 2, {}, "ko"), ...parseActionBatch("자료 검토 | 검토할 때 | 준비한다", "solitary", 0, 1, {}, "ko")]
  const catalog = Object.fromEntries(actions.map((action) => [action.id, action]))
  const card = { name: "민수", role: "담당자", backgroundHistory: "출시 준비", personality: "신중함", preference: "안전한 출시" }
  const actor = buildActor(1, card, "출시", catalog)
  const peer = buildActor(2, { ...card, name: "지수" }, "출시", catalog)
  const input = createActorGraphState({ runId: "run", scenario, plannerDigest: "출시", settings: defaultSettings(), actor, actors: [actor, peer], event, roundIndex: 1, roundDigest: { roundIndex: 1, preRound: { elapsedTime: "1", content: "회의" } }, coordinatorTrace: emptyCoordinatorTrace() })
  expect(isValidActorAction("PUB01", input)).toBe(true)
  expect(isValidActorAction("근거 요청", input)).toBe(false)
  expect(isValidActorAction("PUB99", input)).toBe(false)
  expect(actionAllowedOutputs({ ...input, actors: [actor] })).toEqual(["SOL01", "no_action"])
  expect(targetAllowedOutputs({ ...input, trace: { ...input.trace, action: "SOL01" } })).toEqual(["None"])
  const decision = buildActorDecision({ ...input, trace: { ...input.trace, action: "PUB01", target: peer.id, intent: "근거 확인", message: "자료를 보여주세요." } })
  expect(decision.visibility).toBe(catalog.PUB01!.visibility)
  expect(decision.expectation).toBe(catalog.PUB01!.expectedOutcome)
  const interaction = buildInteraction(1, event, actor, [actor, peer], decision)
  expect(interaction.actionCode).toBe("PUB01")
  expect(interaction.actionType).toBe("근거 요청")
  expect(actor.actions[0]).toBe(catalog.PUB01)
})

test("Planner retries invalid output with feedback and only commits complete batches", async () => {
  const prompts: string[] = []
  let calls = 0
  const spy = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, prompt) => {
    prompts.push(String(prompt)); calls++
    const count = Number(String(prompt).match(/Batch size: (\d+)/)?.[1])
    const text = calls === 1 ? "잘못된 형식" : Array.from({ length: count }, (_, index) => `행동 ${String.fromCharCode(65 + calls)}${String.fromCharCode(65 + index)} | 정보가 필요할 때 | 판단을 준비한다`).join("\n")
    return { text, metrics: { role: "planner", step: "actionCatalog", attempt: calls, ttftMs: 0, durationMs: 1, inputTokens: 0, reasoningTokens: 0, outputTokens: 0, totalTokens: 0, tokenSource: "provider" }, diagnostics: { reasoningContentObserved: false, reasoningContent: "" } }
  })
  try {
    const input = state()
    const events: RunEvent[] = []
    const result = await createPlannerActionsNode(async (event) => { events.push(event) })(input)
    expect(Object.keys(result.simulation!.plan!.actionCatalog)).toHaveLength(16)
    expect(prompts).toHaveLength(9)
    expect(prompts[1]).toContain("Previous response was invalid")
    expect(Object.keys(input.simulation.plan.actionCatalog)).toHaveLength(0)
    expect(events.filter((event) => event.type === "model.metrics")).toHaveLength(9)
  } finally { spy.mockRestore() }
})

test("Planner fails after bounded invalid responses without inventing default actions", async () => {
  const spy = spyOn(invocation, "invokeRoleTextWithMetrics").mockResolvedValue({ text: "", metrics: { role: "planner", step: "actionCatalog", attempt: 1, ttftMs: 0, durationMs: 0, inputTokens: 0, reasoningTokens: 0, outputTokens: 0, totalTokens: 0, tokenSource: "provider" }, diagnostics: { reasoningContentObserved: true, reasoningContent: "reasoning without an answer" } })
  try {
    await expect(createPlannerActionsNode(async () => {})(state())).rejects.toThrow("failed after 5 attempts")
    expect(spy).toHaveBeenCalledTimes(5)
  } finally { spy.mockRestore() }
})
