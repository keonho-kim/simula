/**
 * Purpose: Verify stepwise Planner action acceptance, targeted recovery, and actor-facing codes.
 * Pattern: Workflow contract tests.
 * Usage: bun test src/backend/core/simulation/roles/planner/actions/catalog.test.ts
 * Related: src/backend/core/simulation/roles/planner/actions/node.ts, src/backend/core/simulation/roles/planner/actions/catalog.ts
 */
import { expect, spyOn, test } from "bun:test"
import type { ActionVisibility, RunEvent } from "@/shared"
import * as invocation from "@/backend/integrations/llm/invoke"
import { parseScenarioDocument } from "@/backend/core/scenario"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { initialSimulationState } from "@/backend/core/simulation/workflow/state"
import { buildActor } from "@/backend/core/simulation/roles/generator/state"
import { createActorContext } from "@/backend/core/simulation/roles/actor/context"
import { actionAllowedOutputs, buildActorDecision, createActorGraphState, isValidActorAction } from "@/backend/core/simulation/roles/actor/state"
import { emptyCoordinatorTrace } from "@/backend/core/simulation/roles/coordinator/state"
import { acceptActionLabel, assembleAction, ActionLabelCollision } from "./catalog"
import { createPlannerActionsNode } from "./node"
import { emptyScenarioBoard, updateScenarioBoard } from "@/ui/models/simulation/scenario-board"
import { scenarioBoardColumns } from "@/ui/models/simulation/scenario-board-items"
import { dictionary } from "@/ui/i18n/dictionary"

const scenario = { ...parseScenarioDocument("---\nnum_cast: 2\nactions_per_type: 4\n---\n출시를 논의하는 팀"), language: "ko" as const }
const event = { id: "event-1", title: "회의", summary: "출시 논의", status: "pending" as const, participantIds: [] }
const labels: Record<ActionVisibility, string> = { public: "근거 요청", "semi-public": "공동 검토", private: "개별 문의", solitary: "자료 정리" }

function state(actionsPerType = 1) {
  const current = { ...scenario, controls: { ...scenario.controls, actionsPerType } }
  const simulation = initialSimulationState("run", current)
  return { runId: "run", scenario: current, settings: defaultSettings(),
    simulation: { ...simulation, plan: { interpretation: "팀의 출시 논의", backgroundStory: "팀의 출시 논의", actionCatalog: {}, majorEvents: [event] } } }
}
function result(text: string, attempt = 1): invocation.RoleTextResult {
  return { text, metrics: { role: "planner", step: "actionCatalog", attempt, ttftMs: 0, durationMs: 0,
    inputTokens: 0, reasoningTokens: 0, outputTokens: 0, totalTokens: 0, tokenSource: "unavailable" },
    diagnostics: { reasoningContentObserved: false, reasoningContent: "" } }
}
function fieldAndScope(prompt: string): { field: string; scope: ActionVisibility } {
  const field = prompt.match(/Field: (label|intentHint|expectedOutcome)/)?.[1] ?? ""
  const scope = prompt.match(/Scope: (public|semi-public|private|solitary)/)?.[1] as ActionVisibility | undefined
  if (!scope) throw new Error("Action prompt omitted its visibility scope.")
  return { field, scope }
}

test("code owns action identifiers, bounds long labels, and detects normalized duplicates", () => {
  const label = acceptActionLabel("회의 전에 제안의 비용과 일정을 자세히 다시 검토하고 모두에게 추가 근거를 요청하기", {})
  expect(label).toBe("회의 전에 제안의 비용과 일정을 자세히 다시 검토하고 모두에게 추가")
  expect(acceptActionLabel("Review technical feasibility of delayed launch under budget constraints", {}))
    .toBe("Review technical feasibility")
  const action = assembleAction({ label: "근거 요청", intentHint: "정보가 필요할 때", expectedOutcome: "판단을 준비한다" }, "public", 0)
  expect(action).toMatchObject({ id: "PUB01", visibility: "public", label: "근거 요청" })
  expect(() => acceptActionLabel("근거 요청 2", { PUB01: action })).toThrow(ActionLabelCollision)
  expect(() => acceptActionLabel("PUB01", {})).toThrow("not a code")
  expect(() => acceptActionLabel("", {})).toThrow("complete action name")
})

test("Planner accepts three plain fields per action and streams named previews", async () => {
  const calls: string[] = []
  const spy = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, attempt, prompt, onDelta) => {
    const { field, scope } = fieldAndScope(String(prompt))
    calls.push(`${scope}:${field}:${attempt}`)
    const text = field === "label" ? labels[scope] : field === "intentHint" ? "결정 전에 정보가 필요할 때" : "판단 근거를 확보하려 한다"
    await onDelta?.(text)
    return result(text, attempt)
  })
  try {
    const input = state()
    const events: RunEvent[] = []
    const output = await createPlannerActionsNode(async value => { events.push(value) })(input)
    expect(calls).toHaveLength(12)
    expect(Object.values(output.simulation?.plan?.actionCatalog ?? {}).map(action => action.label)).toEqual(Object.values(labels))
    expect(events.some(value => value.type === "board.updated" && value.update.kind === "preview"
      && value.update.field === "intentHint" && value.update.content === "결정 전에 정보가 필요할 때")).toBe(true)
    expect(events.filter(value => value.type === "board.updated" && value.update.kind === "actions")).toHaveLength(4)
    expect(Object.keys(input.simulation.plan.actionCatalog)).toHaveLength(0)
  } finally { spy.mockRestore() }
})

test("truncation and an empty intent retry only their fields while accepted labels remain", async () => {
  const calls: string[] = []
  const spy = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, attempt, prompt) => {
    const { field, scope } = fieldAndScope(String(prompt))
    calls.push(`${scope}:${field}:${attempt}`)
    const text = scope === "private" && field === "intentHint" && attempt === 1 ? ""
      : field === "label" ? labels[scope] : field === "intentHint" ? "결정 전에 정보가 필요할 때" : "판단 근거를 확보하려 한다"
    const response = result(text, attempt)
    if (scope === "public" && field === "label" && attempt === 1) response.diagnostics.finishReason = "length"
    return response
  })
  try {
    const output = await createPlannerActionsNode(async () => {})(state())
    expect(Object.keys(output.simulation?.plan?.actionCatalog ?? {})).toHaveLength(4)
    expect(calls.filter(value => value.startsWith("public:label"))).toEqual(["public:label:1", "public:label:2"])
    expect(calls.filter(value => value.startsWith("private:label"))).toEqual(["private:label:1"])
    expect(calls.filter(value => value.startsWith("private:intentHint"))).toEqual(["private:intentHint:1", "private:intentHint:2"])
  } finally { spy.mockRestore() }
})

test("persistent cross-scope collisions recover labels without inventing actions", async () => {
  const spy = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, attempt, prompt) => {
    const { field } = fieldAndScope(String(prompt))
    return result(field === "label" ? "자료 검토" : field === "intentHint" ? "정보가 필요할 때" : "판단을 준비한다", attempt)
  })
  try {
    const events: RunEvent[] = []
    const input = state(2)
    const output = await createPlannerActionsNode(async value => { events.push(value) })(input)
    const actions = Object.values(output.simulation?.plan?.actionCatalog ?? {})
    expect(actions.map(action => action.id)).toEqual(["PUB01", "GRP01", "PRV01", "SOL01"])
    expect(new Set(actions.map(action => action.label)).size).toBe(4)
    expect(events.some(value => value.type === "log" && value.level === "warn" && value.message.includes("recovered"))).toBe(true)
    expect(events.findLast(value => value.type === "board.updated" && value.update.kind === "config"))
      .toMatchObject({ update: { actionCount: 4, actorCount: 2 } })
    const board = updateScenarioBoard(emptyScenarioBoard(), events)
    expect(board.actions).toHaveLength(4)
    expect(scenarioBoardColumns(board, dictionary.ko)[2]?.items.some(item => item.id === "actions-pending")).toBe(false)
  } finally { spy.mockRestore() }
})

test("an incomplete first label fails after five attempts and transport errors propagate once", async () => {
  const empty = spyOn(invocation, "invokeRoleTextWithMetrics").mockResolvedValue(result(""))
  try {
    await expect(createPlannerActionsNode(async () => {})(state())).rejects.toThrow("label failed after 5 attempts")
    expect(empty).toHaveBeenCalledTimes(5)
  } finally { empty.mockRestore() }
  const disconnected = spyOn(invocation, "invokeRoleTextWithMetrics").mockRejectedValue(new Error("connection refused"))
  try {
    await expect(createPlannerActionsNode(async () => {})(state())).rejects.toThrow("connection refused")
    expect(disconnected).toHaveBeenCalledTimes(1)
  } finally { disconnected.mockRestore() }
})

test("Actor selects program-owned codes from the accepted action map", () => {
  const action = assembleAction({ label: "근거 요청", intentHint: "정보가 필요할 때", expectedOutcome: "판단을 준비한다" }, "public", 0)
  const catalog = { PUB01: action }
  const card = { name: "민수", role: "담당자", backgroundHistory: "출시 준비", personality: "신중함", preference: "안전한 출시" }
  const actor = buildActor(1, card, "출시", catalog)
  const peer = buildActor(2, { ...card, name: "지수" }, "출시", catalog)
  const input = { ...createActorContext({ runId: "run", scenario, plannerDigest: "출시", actor, actors: [actor, peer], event,
    roundIndex: 1, roundDigest: { roundIndex: 1, preRound: { elapsedTime: "1", content: "회의" } },
    coordinatorTrace: emptyCoordinatorTrace() }), ...createActorGraphState() }
  expect(actionAllowedOutputs(input)).toContain("PUB01")
  expect(isValidActorAction("근거 요청", input)).toBe(false)
  const decision = buildActorDecision({ ...input, trace: { ...input.trace,
    action: "PUB01", target: peer.id, intent: "근거 확인", message: "자료를 보여주세요." } })
  expect(decision.expectation).toBe(action.expectedOutcome)
})
