/**
 * Purpose: Verify incremental retained-memory ingestion, repair and survival beyond recent history.
 * Pattern: Model-boundary and round workflow tests.
 * Usage: bun test src/backend/core/simulation/actors/retain-memory.test.ts
 * Related: src/backend/core/simulation/actors/retain-memory.ts, src/backend/core/simulation/actors/memory.ts
 */
import { expect, spyOn, test } from "bun:test"
import type { RunEvent, SimulationState } from "@/shared"
import { defaultSettings } from "@/backend/core/settings/defaults"
import * as invocation from "@/backend/integrations/llm/invoke"
import { buildActor } from "../roles/generator/state"
import { actorPromptContext, applyInjectedEventContext, compressActorContext, contextUsedByActor } from "./memory"
import { retainActorMemory } from "./retain-memory"
import { initialSimulationState } from "../workflow/state"
import { coordinatorNode } from "../roles/coordinator/nodes"

const scenario = { text: "A team reviews a release", controls: { numCast: 1, maxRound: 1, fastMode: false,
  actionsPerType: 1, allowAdditionalCast: false } }
const execution = { runId: "retain-run", scenario, settings: defaultSettings(), emit: async () => {} }
const noChanges = "0"
const promise = "I will deliver the revised budget tomorrow."
const added = promise

function actor() {
  return buildActor(1, { name: "Finance", role: "Finance owner", backgroundHistory: "Planning a release",
    personality: "Practical", preference: "A sound budget" }, "Meeting", {})
}
function result(text: string): invocation.RoleTextResult {
  return { text, metrics: { role: "actor", step: "context", attempt: 1, ttftMs: 0, durationMs: 0, inputTokens: 0,
    reasoningTokens: 0, outputTokens: 0, totalTokens: 0, tokenSource: "unavailable" }, diagnostics: { reasoningContentObserved: false, reasoningContent: "" } }
}

test("retained memory uses plain quotes and choices before code assembles a record", async () => {
  const original = actor()
  original.context.visible = [{ id: "promise", kind: "self", roundIndex: 1, content: promise }]
  const prompts: string[] = []
  const text = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, prompt) => {
    prompts.push(String(prompt))
    return result(prompts.filter(value => value.includes("Field: addition-quote")).length === 1 ? promise : "0")
  })
  const choice = spyOn(invocation, "invokeExactChoiceWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, prompt) => {
    prompts.push(String(prompt))
    return result("commitment")
  })
  try {
    const retained = await retainActorMemory(original, execution)
    expect(retained.context.ledger?.records[0]).toMatchObject({ quote: promise, kind: "commitment" })
    expect(prompts.some(value => value.includes("Return one JSON object"))).toBe(false)
    expect(prompts.some(value => value.includes("Field: addition-kind"))).toBe(true)
  } finally { text.mockRestore(); choice.mockRestore() }
})

test("retained promises survive unrelated turns and a summary that omits them without reprocessing history", async () => {
  const original = actor()
  original.context.visible = [{ id: "promise", kind: "self", roundIndex: 1, content: promise }]
  let calls = 0
  let additionCalls = 0
  const model = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, prompt, _delta, options) => {
    calls++
    if (prompt.includes("Field: addition-quote")) {
      expect(options?.maxOutputTokens).toBeUndefined()
      additionCalls++
      return result(additionCalls === 1 ? "not in the entry" : additionCalls === 2 ? added : noChanges)
    }
    return result("The team discussed the latest release.")
  })
  const choice = spyOn(invocation, "invokeExactChoiceWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, _prompt, allowed) =>
    result(allowed.includes("commitment") ? "commitment" : "0"))
  try {
    const retained = await retainActorMemory(original, execution)
    expect(calls).toBe(3)
    expect(await retainActorMemory(retained, execution)).toBe(retained)
    expect(calls).toBe(3)
    expect(original.context.ledger).toBeUndefined()
    let later = retained
    for (let roundIndex = 2; roundIndex <= 30; roundIndex++) {
      later = applyInjectedEventContext([later], { id: `event-${roundIndex}`, roundIndex, sourceEventId: "release",
        title: "Review", summary: "Discussion continues." })[0]!
    }
    const compressed = await compressActorContext(later, { ...execution, roundIndex: 30 })
    expect(compressed.contextSummary).not.toContain(promise)
    expect(actorPromptContext(compressed)).toContain(promise)
    expect(contextUsedByActor(compressed).join("\n")).toContain(promise)
    expect(compressed.context.ledger?.processedCount).toBe(30)
    const callCount = calls
    expect(await retainActorMemory(compressed, execution)).toBe(compressed)
    expect(calls).toBe(callCount)
    // The accepted ledger travels with the existing serializable actor state.
    expect(JSON.parse(JSON.stringify(compressed)).context.ledger.records[0].quote).toBe(promise)
  } finally { model.mockRestore(); choice.mockRestore() }
})

test("incomplete memory updates retain visible history and warn after bounded repair", async () => {
  const original = actor()
  original.context.visible = [{ id: "promise", kind: "self", roundIndex: 1, content: promise }]
  const model = spyOn(invocation, "invokeRoleTextWithMetrics").mockResolvedValue(result("not in the entry"))
  const warnings: RunEvent[] = []
  try {
    const retained = await retainActorMemory(original, { ...execution, emit: async event => { if (event.type === "log") warnings.push(event) } })
    expect(model).toHaveBeenCalledTimes(3)
    expect(original.context.ledger).toBeUndefined()
    expect(retained.context.visible).toEqual(original.context.visible)
    expect(retained.context.ledger).toMatchObject({ processedCount: 1, lastEntryId: "promise", records: [] })
    expect(warnings.some(event => event.type === "log" && event.level === "warn" && event.message.includes("retained memory"))).toBe(true)
    original.context.ledger = { processedCount: 2, lastEntryId: "foreign", records: [] }
    await expect(retainActorMemory(original, execution)).rejects.toThrow("cursor")
    expect(model).toHaveBeenCalledTimes(3)
  } finally { model.mockRestore() }
})

test("an incomplete later update leaves earlier accepted memory active", async () => {
  const original = actor()
  original.context.visible = [{ id: "accepted", kind: "self", roundIndex: 1, content: promise },
    { id: "later", kind: "self", roundIndex: 2, content: "The budget remains under review." }]
  original.context.ledger = { processedCount: 1, lastEntryId: "accepted", records: [{
    id: `${original.id}:memory:1`, kind: "commitment", quote: promise, sourceEntryId: "accepted",
    sourceActorId: original.id, roundIndex: 1, status: "active",
  }] }
  const model = spyOn(invocation, "invokeRoleTextWithMetrics").mockResolvedValue(result("not in the entry"))
  try {
    const retained = await retainActorMemory(original, execution)
    expect(retained.context.ledger?.processedCount).toBe(2)
    expect(retained.context.ledger?.records).toEqual(original.context.ledger.records)
    expect(retained.context.visible).toEqual(original.context.visible)
  } finally { model.mockRestore() }
})

test("the final round retains its promise before the simulation returns", async () => {
  const simulation = initialSimulationState(execution.runId, scenario)
  const person = actor()
  person.actions = [{ id: "SOL01", visibility: "solitary", label: "Review", intentHint: "When needed", expectedOutcome: "Clarity" }]
  simulation.actors = [person]
  const text = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, step, _attempt, prompt) => {
    if (prompt.includes("Field: addition-quote")) return result(prompt.includes('"acceptedQuotes"') ? noChanges : prompt.includes(promise) ? added : noChanges)
    return result(step === "message" ? promise : step === "thought" ? "I need to review this." : "Review the budget.")
  })
  const choice = spyOn(invocation, "invokeExactChoiceWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, _prompt, allowed) => result(allowed[0]!))
  const saved: SimulationState[] = []
  try {
    const completed = await coordinatorNode({ ...execution, simulation }, async () => {}, 0, undefined, undefined,
      async state => { saved.push(structuredClone(state)) })
    const memory = completed.simulation?.actors[0]?.context.ledger
    expect(memory?.records[0]?.quote).toBe(promise)
    expect(memory?.processedCount).toBe(completed.simulation?.actors[0]?.context.visible.length)
    expect(completed.simulation?.interactions).toHaveLength(1)
    expect(saved[0]?.interactions).toHaveLength(1)
    expect(saved[0]?.actors[0]?.context.ledger?.records ?? []).toEqual([])
    expect(saved.at(-1)?.actors[0]?.context.ledger?.records[0]?.quote).toBe(promise)
    expect(saved.at(-1)?.reportMarkdown).not.toBe("")
    text.mockImplementation(async (_settings, _role, step, _attempt, prompt) => result(prompt.includes("Field: addition-quote")
      ? "not in the entry" : step === "message" ? promise : step === "thought" ? "I need to review this." : "Review the budget."))
    const recoveredSnapshots: SimulationState[] = []
    const recovered = await coordinatorNode({ ...execution, simulation }, async () => {}, 0, undefined, undefined,
      async state => { recoveredSnapshots.push(structuredClone(state)) })
    expect(recovered.simulation?.interactions).toHaveLength(1)
    expect(recovered.simulation?.actors[0]?.context.ledger).toMatchObject({ processedCount: 1, records: [] })
    expect(recoveredSnapshots[0]?.actors[0]?.context.visible.at(-1)?.content).toContain(promise)
  } finally { text.mockRestore(); choice.mockRestore() }
})

for (const fastMode of [false, true]) test(`memory model work follows fast mode (${fastMode})`, async () => {
  const inputScenario = { ...scenario, controls: { ...scenario.controls, numCast: 2, fastMode } }
  const simulation = initialSimulationState(execution.runId, inputScenario)
  simulation.actors = [actor(), { ...actor(), id: "actor-2", name: "CTO" }]
  let inFlight = 0
  let peak = 0
  const model = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, prompt) => {
    const retained = prompt.includes("Actor retained memory.")
    if (retained || prompt.includes("Compress memory for the actor")) {
      inFlight++
      peak = Math.max(peak, inFlight)
      await Promise.resolve()
      inFlight--
    }
    return result(retained ? noChanges : "The team considers its next step.")
  })
  const choice = spyOn(invocation, "invokeExactChoiceWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, _prompt, allowed) => result(allowed[0]!))
  try {
    await coordinatorNode({ ...execution, scenario: inputScenario, simulation }, async () => {})
    expect(peak).toBe(fastMode ? 2 : 1)
    expect(inFlight).toBe(0)
  } finally { model.mockRestore(); choice.mockRestore() }
})
