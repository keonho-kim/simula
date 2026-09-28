/**
 * Purpose: Verify solitary actions produce private action records instead of recipient speech.
 * Pattern: Workflow contract test with controlled model output.
 * Usage: bun test src/backend/core/simulation/roles/actor/solitary.test.ts
 * Related: src/backend/core/simulation/roles/actor/nodes.ts, src/backend/core/simulation/actors/interactions.ts
 */
import { expect, spyOn, test } from "bun:test"
import { buildActorChoiceState, buildDigestSimulation } from "../../../../../../packages/core/tests/scenario-fixtures"
import { defaultSettings } from "@/backend/core/settings/defaults"
import * as invocation from "@/backend/integrations/llm/invoke"
import { actorPrompts } from "./prompts"
import { buildActorDecision } from "./state"
import { createActorStepNode } from "./nodes"
import { buildInteraction } from "../../actors/interactions"
import { emptyCoordinatorTrace } from "../coordinator/state"
import { runActorRound } from "../coordinator/actor-round"
import type { RunEvent } from "@/shared"

function state(language: "ko" | "en" = "ko") {
  const input = buildActorChoiceState()
  input.scenario.language = language
  input.actor.actions = [{ id: "SOL01", visibility: "solitary", label: "자료 정리", intentHint: "판단 전", expectedOutcome: "선택 비교" }]
  input.trace = { ...input.trace, action: "SOL01", target: "None", thought: "지금 결정하면 성급할 것 같다.", intent: "선택에 필요한 근거를 정리한다." }
  return input
}
function result(text: string): invocation.RoleTextResult {
  return { text, metrics: { role: "actor", step: "message", attempt: 1, ttftMs: 0, durationMs: 0,
    inputTokens: 0, reasoningTokens: 0, outputTokens: 0, totalTokens: 0, tokenSource: "unavailable" },
  diagnostics: { reasoningContentObserved: false, reasoningContent: "" } }
}

test("solitary target is deterministic and makes no model call", async () => {
  const input = state()
  const choice = spyOn(invocation, "invokeExactChoiceWithMetrics").mockResolvedValue(result("None"))
  try {
    const output = await createActorStepNode("target", input, defaultSettings(), async () => {})(input)
    expect(output.trace?.target).toBe("None")
    expect(choice).not.toHaveBeenCalled()
  } finally { choice.mockRestore() }
})

for (const language of ["ko", "en"] as const) test(`solitary output and repair describe an action without a recipient (${language})`, async () => {
  const input = state(language)
  const replies = ["None", input.trace.intent, "메모에 확인된 사실과 아직 모르는 점을 나누어 적는다."]
  const prompts: string[] = []
  const text = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, prompt) => {
    prompts.push(prompt)
    return result(replies[prompts.length - 1]!)
  })
  try {
    const output = await createActorStepNode("message", input, defaultSettings(), async () => {})(input)
    expect(prompts).toHaveLength(3)
    expect(prompts[0]).toContain("Actor solitary action")
    expect(prompts[0]).not.toContain("express a request, question, or reply")
    expect(prompts[2]).not.toContain("상대에게 실제로 하는 요청")
    expect(prompts[2]).not.toContain("reply to the recipient")
    const decision = buildActorDecision({ ...input, trace: output.trace! })
    expect(decision.message).toBeUndefined()
    expect(decision.actionDescription).toBe(replies[2])
    expect(decision.targetActorIds).toEqual([])
    const actor = buildDigestSimulation().actors[0]!
    const interaction = buildInteraction(1, { ...input.event, id: "event", status: "active", participantIds: [] }, actor, [actor], decision)
    expect(interaction.content).toBe(replies[2])
    expect(interaction.visibility).toBe("solitary")
  } finally { text.mockRestore() }
})

test("solitary records reach only their author's memory and never emit actor speech", async () => {
  const input = state()
  const simulation = buildDigestSimulation()
  const author = { ...simulation.actors[0]!, actions: input.actor.actions }
  const peer = { ...author, id: "actor-2", name: "Peer", actions: [] }
  const events: RunEvent[] = []
  const text = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, step) =>
    result(step === "thought" ? input.trace.thought : step === "intent" ? input.trace.intent : "확인할 항목을 메모한다."))
  const choice = spyOn(invocation, "invokeExactChoiceWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, _prompt, allowed) => result(allowed[0]!))
  try {
    const round = await runActorRound({ runId: input.runId, scenario: { ...input.scenario, text: simulation.scenario.text }, settings: defaultSettings(), simulation },
      [author, peer], { ...input.event, id: "event", status: "active", participantIds: [] }, { ...input.roundDigest, roundIndex: 1 }, 1, { ...emptyCoordinatorTrace(), ...input.coordinatorTrace }, async event => { events.push(event) })
    expect(events.filter(event => event.type === "actor.message")).toEqual([])
    expect(round.interactions[0]?.content).toBe("확인할 항목을 메모한다.")
    expect(round.actors[0]?.context.visible.some(entry => entry.content.includes("확인할 항목"))).toBe(true)
    expect(round.actors[1]?.context.visible.some(entry => entry.content.includes("확인할 항목"))).toBe(false)
  } finally { text.mockRestore(); choice.mockRestore() }
})

test("action selection identifies solitary scope before choosing a target", () => {
  const input = state()
  const prompt = actorPrompts.action(input, input.trace)
  expect(prompt).toContain("scope: solitary")
  expect(prompt).toContain("not a conversation with yourself")
  for (const language of ["ko", "en"] as const) {
    input.scenario.language = language
    const thought = actorPrompts.thought(input, input.trace)
    expect(thought).toContain(language === "ko" ? "1인칭" : "first-person")
  }
})
