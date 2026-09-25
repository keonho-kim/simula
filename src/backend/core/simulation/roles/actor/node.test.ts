/**
 * Purpose: Verify actor field retries and separation of private thought from speech.
 * Pattern: Focused workflow-node test.
 * Usage: bun test src/backend/core/simulation/roles/actor/node.test.ts
 * Related: src/backend/core/simulation/roles/actor/node.ts, src/backend/core/simulation/roles/actor/prompts/index.ts
 */
import { expect, spyOn, test } from "bun:test"
import type { RunEvent } from "@/shared"
import * as invocation from "@/backend/integrations/llm/invoke"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { parseScenarioDocument } from "@/backend/core/scenario"
import { buildActor } from "@/backend/core/simulation/roles/generator/state"
import { emptyCoordinatorTrace } from "@/backend/core/simulation/roles/coordinator/state"
import { createActorGraphState } from "./state"
import { createActorContext } from "./context"
import { createActorStepNode } from "./nodes"

function state(language: "ko" | "en" = "ko") {
  const actor = buildActor(1, { name: "민수", role: "담당자", backgroundHistory: "출시 준비", personality: "신중함", preference: "안전한 출시" }, "출시", {})
  const input = { ...createActorContext({ runId: "run", scenario: { ...parseScenarioDocument("---\nnum_cast: 2\n---\n출시를 논의하는 팀"), language }, plannerDigest: "출시 일정 협의", actor, actors: [actor], event: { id: "event", title: "출시 회의", summary: "일정을 결정한다", status: "pending", participantIds: [] }, roundIndex: 1, roundDigest: { roundIndex: 1, preRound: { elapsedTime: "1", content: "답변을 기다리는 상황" } }, coordinatorTrace: emptyCoordinatorTrace() }), ...createActorGraphState() }
  input.actor.actions = [{ id: "SOL01", visibility: "solitary", label: "입장 정리", intentHint: "판단이 필요할 때", expectedOutcome: "판단을 준비한다" }]
  input.trace = { ...input.trace, action: "SOL01", target: "None", thought: "거절하면 관계가 어색해질까 걱정된다.", intent: "답변할 시간을 확보한다." }
  return input
}
function result(text: string): invocation.RoleTextResult {
  return { text, metrics: { role: "actor", step: "message", attempt: 1, ttftMs: 0, durationMs: 0, inputTokens: 0, reasoningTokens: 0, outputTokens: 0, totalTokens: 0, tokenSource: "unavailable" }, diagnostics: { reasoningContentObserved: false, reasoningContent: "" } }
}

test("copied thought and intent retry only speech with targeted feedback", async () => {
  const input = state()
  const prompts: string[] = []
  const replies = ['“거절하면관계가어색해질까걱정된다!”', input.trace.intent, "조금 더 생각하고 내일 답해도 될까?"]
  const events: RunEvent[] = []
  const spy = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, step, _attempt, prompt) => {
    expect(step).toBe("message")
    prompts.push(String(prompt))
    return result(replies[prompts.length - 1] ?? "")
  })
  try {
    const output = await createActorStepNode("message", input, defaultSettings(), async event => { events.push(event) })(input)
    expect(prompts).toHaveLength(3)
    expect(prompts[1]).toContain("생각")
    expect(prompts[1]).toContain("거절하면관계가어색해질까걱정된다")
    expect(prompts[2]).toContain("의도")
    expect(output.trace).toMatchObject({ thought: input.trace.thought, intent: input.trace.intent, message: replies[2], retryCounts: { message: 2 } })
    expect(input.trace.message).toBe("")
    expect(events.filter(event => event.type === "model.message")).toHaveLength(1)
  } finally { spy.mockRestore() }
})

test("similar meaning and silence remain valid; no_action makes no call", async () => {
  const input = state()
  const spy = spyOn(invocation, "invokeRoleTextWithMetrics").mockResolvedValueOnce(result("답변할 시간을 조금만 주시겠어요?")).mockResolvedValueOnce(result("None"))
  try {
    expect((await createActorStepNode("message", input, defaultSettings(), async () => {})(input)).trace?.retryCounts.message).toBe(0)
    expect((await createActorStepNode("message", input, defaultSettings(), async () => {})(input)).trace?.message).toBe("None")
    input.trace.action = "no_action"
    expect((await createActorStepNode("message", input, defaultSettings(), async () => {})(input)).trace?.message).toBe("None")
    expect(spy).toHaveBeenCalledTimes(2)
  } finally { spy.mockRestore() }
})

test("persistent copied speech fails after three attempts without publishing it", async () => {
  const input = state("en")
  input.trace.thought = "I need time to decide."
  const prompts: string[] = []
  const events: RunEvent[] = []
  const spy = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, prompt) => {
    prompts.push(String(prompt))
    return result("I need time to decide!")
  })
  try {
    await expect(createActorStepNode("message", input, defaultSettings(), async event => { events.push(event) })(input)).rejects.toThrow("3 invalid responses")
    expect(spy).toHaveBeenCalledTimes(3)
    expect(prompts[1]).toContain("copied thought")
    expect(events.filter(event => event.type === "model.message")).toHaveLength(0)
  } finally { spy.mockRestore() }
})

test("intent receives the preceding thought and current situation", async () => {
  const input = state()
  const prompts: string[] = []
  const spy = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, prompt) => {
    prompts.push(String(prompt))
    return result("판단할 시간을 확보한다.")
  })
  try {
    await createActorStepNode("intent", input, defaultSettings(), async () => {})(input)
    expect(prompts[0]).toContain(input.trace.thought)
    expect(prompts[0]).toContain(input.event.summary)
    expect(prompts[0]).toContain(input.roundDigest.preRound.content)
  } finally { spy.mockRestore() }
})

test("actor text retries responses that combine thought, intent, and speech", async () => {
  const input = state("en")
  const replies = [
    "Thought: The date is at risk. / Intent: Ask about the reserve. / Message: Can we use it?",
    "The date is at risk, and I need to understand the reserve constraint.",
  ]
  const prompts: string[] = []
  const spy = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, prompt) => {
    prompts.push(String(prompt))
    return result(replies.shift() ?? "")
  })
  try {
    const output = await createActorStepNode("thought", input, defaultSettings(), async () => {})(input)
    expect(output.trace?.thought).toBe("The date is at risk, and I need to understand the reserve constraint.")
    expect(output.trace?.retryCounts.thought).toBe(1)
    expect(prompts[1]).toContain("current step")
  } finally { spy.mockRestore() }
})
