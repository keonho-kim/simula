/**
 * Purpose: Verify autonomous and fixed coordinator round progression contracts.
 * Pattern: Workflow contract test.
 * Usage: Executed by bun test with deterministic model doubles.
 * Related: src/backend/core/simulation/roles/coordinator/progress.ts, src/backend/core/simulation/roles/coordinator/nodes.ts
 */
import { expect, spyOn, test } from "bun:test"
import * as invocation from "@/backend/integrations/llm/invoke"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { normalizeScenarioControls, parseScenarioDocument } from "@/backend/core/scenario"
import { initialSimulationState, type WorkflowState } from "@/backend/core/simulation/workflow/state"
import { progressSnapshot } from "./progress"
import { coordinatorNode } from "./nodes"

function state(autonomousProgress = false): WorkflowState {
  const scenario = parseScenarioDocument("---\nnum_cast: 1\nmax_round: 1\n---\nDecide a release date.")
  Object.assign(scenario.controls, { autonomousProgress })
  const simulation = initialSimulationState("progress-test", scenario)
  simulation.plan = { interpretation: "Release", backgroundStory: "Date undecided", actionCatalog: {}, majorEvents: [{ id: "event-1", title: "Release date", summary: "Choose a date", status: "pending", participantIds: [] }] }
  return { runId: simulation.runId, scenario, settings: defaultSettings(), simulation }
}

async function run(autonomous: boolean, answers: string[]) {
  const prompts: string[] = []
  const steps: string[] = []
  const pauses: number[] = []
  const exact = spyOn(invocation, "invokeExactChoiceWithMetrics").mockImplementation(async (_settings, role, step, attempt, prompt) => {
    steps.push(step)
    let text = step === "eventInjection" ? "event-1" : "partial"
    if (step === "progressDecision") {
      prompts.push(String(prompt))
      text = answers.shift() ?? "0"
    }
    return result(text, role, step, attempt)
  })
  const prose = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, role, step, attempt) => result("The date is still undecided.", role, step, attempt))
  try {
    const outcome = await coordinatorNode(state(autonomous), async () => {}, 0, async round => { pauses.push(round) })
    return { outcome, prompts, steps, pauses }
  } finally { exact.mockRestore(); prose.mockRestore() }
}

function result(text: string, role: invocation.RoleTextResult["metrics"]["role"], step: invocation.RoleTextResult["metrics"]["step"], attempt: number): invocation.RoleTextResult {
  return { text, metrics: { role, step, attempt, ttftMs: 0, durationMs: 0, inputTokens: 0, reasoningTokens: 0, outputTokens: 0, totalTokens: 0, tokenSource: "unavailable" }, diagnostics: { reasoningContentObserved: false, reasoningContent: "" } }
}

test("fixed mode respects max round without progress or extension calls", async () => {
  const { outcome, steps, pauses } = await run(false, ["1"])
  expect(outcome.simulation?.roundDigests).toHaveLength(1)
  expect(steps).not.toContain("progressDecision")
  expect(steps).not.toContain("extensionDecision")
  expect(pauses).toEqual([])
})

test("autonomous mode exceeds max only on 1 and stops on 0 despite reinjection", async () => {
  const { outcome, prompts, pauses } = await run(true, ["1", "0"])
  expect(outcome.simulation?.roundDigests).toHaveLength(2)
  expect(outcome.simulation?.stopReason).toBe("no_progress")
  expect(outcome.simulation?.scenario.controls.maxRound).toBe(1)
  expect(pauses).toEqual([1])
  expect(prompts[0]).toContain('"roundIndex":0')
  expect(prompts[1]).toContain('"roundIndex":1')
  expect(prompts[1]).toContain('"roundIndex":2')
  expect(prompts[1]).toContain("Previous situation and actions:")
  expect(prompts[1]).toContain("Current situation and actions:")
})

test("invalid progress text retries rather than silently continuing", async () => {
  const { outcome, prompts } = await run(true, ["continue", "invalid", "0"])
  expect(outcome.simulation?.roundDigests).toHaveLength(1)
  expect(outcome.simulation?.stopReason).toBe("no_progress")
  expect(prompts.length).toBeGreaterThan(1)
})

test("autonomous progress is opt-in and validated in document and API controls", () => {
  expect(normalizeScenarioControls({ numCast: 1 })).toHaveProperty("autonomousProgress", false)
  expect(parseScenarioDocument("---\nnum_cast: 1\nautonomous_progress: true\n---\nStory").controls).toHaveProperty("autonomousProgress", true)
  expect(() => normalizeScenarioControls({ numCast: 1, ...JSON.parse('{"autonomousProgress":"false"}') })).toThrow()
})


test("progress comparison preserves prior actions and event statuses without mutation", () => {
  const input = state(true)
  input.simulation.roundDigests = [{ roundIndex: 1, preRound: { elapsedTime: "1", content: "Date undecided" } }]
  input.simulation.interactions = [{ id: "i-1", eventId: "event-1", roundIndex: 1, sourceActorId: "actor-1", targetActorIds: ["actor-2"], actionType: "Propose", content: "Shall we release Friday?", intent: "Choose a date", expectation: "Agreement", visibility: "public", decisionType: "action" }]
  const previous = progressSnapshot(input)
  input.simulation.roundDigests.push({ roundIndex: 2, preRound: { elapsedTime: "2", content: "Date confirmed" } })
  const action = input.simulation.interactions[0]
  if (!action) throw new Error("Missing action fixture")
  input.simulation.interactions.push({ ...action, id: "i-2", roundIndex: 2, content: "Friday agreed. I will publish it." })
  const event = input.simulation.plan?.majorEvents[0]
  if (!event) throw new Error("Missing event fixture")
  event.status = "completed"
  const current = progressSnapshot(input)
  expect(previous).toContain("Shall we release Friday?")
  expect(previous).toContain('"status":"pending"')
  expect(current).toContain("Friday agreed. I will publish it.")
  expect(current).toContain('"status":"completed"')
  expect(current).not.toContain("Shall we release Friday?")
})

test("exhausted invalid progress responses fail explicitly instead of extending", async () => {
  await expect(run(true, Array.from({ length: 10 }, () => "invalid"))).rejects.toThrow("progressDecision failed after 5 invalid responses")
})
