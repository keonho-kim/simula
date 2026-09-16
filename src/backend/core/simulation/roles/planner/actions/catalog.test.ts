import { expect, spyOn, test } from "bun:test"
import type { RunEvent } from "@/shared"
import * as invocation from "@/backend/integrations/llm/invoke"
import { parseScenarioDocument } from "@/backend/core/scenario"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { initialSimulationState } from "@/backend/core/simulation/workflow/state"
import { buildActor } from "@/backend/core/simulation/roles/generator/state"
import { actionAllowedOutputs, buildActorDecision, createActorGraphState, isValidActorAction } from "@/backend/core/simulation/roles/actor/state"
import { emptyCoordinatorTrace } from "@/backend/core/simulation/roles/coordinator/state"
import { parseAction } from "./catalog"
import { createPlannerActionsNode } from "./node"

const json = (label: string) => JSON.stringify({ label, intentHint: "정보가 필요할 때", expectedOutcome: "판단을 준비한다" })
const scenario = { ...parseScenarioDocument("---\nnum_cast: 2\nactions_per_type: 4\n---\n출시를 논의하는 팀"), language: "ko" as const }
const event = { id: "event-1", title: "회의", summary: "출시 논의", status: "pending" as const, participantIds: [] }
function state() {
  const simulation = initialSimulationState("run", scenario)
  return { runId: "run", scenario, settings: defaultSettings(), simulation: { ...simulation, plan: { interpretation: "팀의 출시 논의", backgroundStory: "팀의 출시 논의", actionCatalog: {}, majorEvents: [event] } } }
}
function result(text: string, attempt = 1): invocation.RoleTextResult {
  return { text, metrics: { role: "planner", step: "actionCatalog", attempt, ttftMs: 0, durationMs: 0, inputTokens: 0, reasoningTokens: 0, outputTokens: 0, totalTokens: 0, tokenSource: "unavailable" }, diagnostics: { reasoningContentObserved: false, reasoningContent: "" } }
}

test("JSON actions receive program-owned codes and scope", () => {
  expect(parseAction(json("근거 요청"), "public", 0, {}, "ko")).toEqual({ id: "PUB01", visibility: "public", label: "근거 요청", intentHint: "정보가 필요할 때", expectedOutcome: "판단을 준비한다" })
  expect(parseAction('```json\n' + json("자료 검토") + '\n```', "solitary", 3, {}, "ko").id).toBe("SOL04")
})

test("invalid JSON, field types, language and normalized duplicates fail explicitly", () => {
  const existing = { PUB01: parseAction(json("근거 요청"), "public", 0, {}, "ko") }
  expect(() => parseAction('근거 요청 | 정보가 필요할 때 | 판단을 준비한다', "private", 0, {}, "ko")).toThrow("valid JSON")
  expect(() => parseAction('{"label":"근거 요청"', "private", 0, {}, "ko")).toThrow("valid JSON")
  expect(() => parseAction(JSON.stringify([JSON.parse(json("근거 요청"))]), "public", 0, {}, "ko")).toThrow()
  expect(() => parseAction(JSON.stringify({ ...JSON.parse(json("근거 요청")), intentHint: 3 }), "public", 0, {}, "ko")).toThrow("intentHint")
  expect(() => parseAction(JSON.stringify({ ...JSON.parse(json("근거 요청")), intentHint: "Need information" }), "public", 0, {}, "ko")).toThrow("intentHint: 값은 한국어")
  expect(() => parseAction(json("근거 요청 2"), "private", 0, existing, "ko")).toThrow("PUB01 (public)")
  expect(() => parseAction(json("PUB01"), "public", 0, {}, "ko")).toThrow("not a code")
})

test("Actor still selects codes from the accepted JSON action map", () => {
  const action = parseAction(json("근거 요청"), "public", 0, {}, "ko")
  const catalog = { PUB01: action }
  const card = { name: "민수", role: "담당자", backgroundHistory: "출시 준비", personality: "신중함", preference: "안전한 출시" }
  const actor = buildActor(1, card, "출시", catalog)
  const peer = buildActor(2, { ...card, name: "지수" }, "출시", catalog)
  const input = createActorGraphState({ runId: "run", scenario, plannerDigest: "출시", settings: defaultSettings(), actor, actors: [actor, peer], event, roundIndex: 1, roundDigest: { roundIndex: 1, preRound: { elapsedTime: "1", content: "회의" } }, coordinatorTrace: emptyCoordinatorTrace() })
  expect(actionAllowedOutputs(input)).toContain("PUB01")
  expect(isValidActorAction("근거 요청", input)).toBe(false)
  const decision = buildActorDecision({ ...input, trace: { ...input.trace, action: "PUB01", target: peer.id, intent: "근거 확인", message: "자료를 보여주세요." } })
  expect(decision.expectation).toBe(action.expectedOutcome)
  expect(actor.actions[0]).toBe(action)
})

test("generation is sequential, retries only the failed slot, and keeps accepted actions", async () => {
  const calls: string[] = []
  let inFlight = 0
  let maxInFlight = 0
  const spy = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, attempt, prompt) => {
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight)
    const scope = String(prompt).match(/Scope: (.+)/)![1]!
    const index = Number(String(prompt).match(/이 범위의 (\d+)/)![1])
    calls.push(`${scope}:${index}`)
    await Promise.resolve()
    inFlight--
    if (scope === "private" && index === 1 && attempt === 1) return result(JSON.stringify({ label: "개별 협의", intentHint: "Need information", expectedOutcome: "판단을 준비한다" }), attempt)
    if (scope === "private" && index === 1 && attempt === 2) return result(json("public 행동 B"), attempt)
    return result(json(`${scope} 행동 ${String.fromCharCode(65 + index)}`), attempt)
  })
  try {
    const input = state()
    const events: RunEvent[] = []
    const output = await createPlannerActionsNode(async event => { events.push(event) })(input)
    expect(Object.keys(output.simulation!.plan!.actionCatalog)).toHaveLength(16)
    expect(maxInFlight).toBe(1)
    expect(calls.filter(call => call === "private:1")).toHaveLength(3)
    expect(calls.filter(call => call === "public:1")).toHaveLength(1)
    const updates = events.flatMap(event => event.type === "board.updated" && event.update.kind === "actions" ? [event.update.actions] : [])
    expect(updates).toHaveLength(16)
    expect(updates.every(actions => actions.length === 1)).toBe(true)
    expect(Object.keys(input.simulation.plan.actionCatalog)).toHaveLength(0)
  } finally { spy.mockRestore() }
})

test("repeated malformed JSON fails after a bounded number of attempts", async () => {
  const spy = spyOn(invocation, "invokeRoleTextWithMetrics").mockResolvedValue(result("not JSON"))
  try {
    await expect(createPlannerActionsNode(async () => {})(state())).rejects.toThrow("failed after 5 attempts")
    expect(spy).toHaveBeenCalledTimes(5)
  } finally { spy.mockRestore() }
})
