/**
 * Purpose: Verify shared retained-memory extraction, audience isolation, ordering, and call accounting.
 * Pattern: Model-boundary and coordinator workflow tests.
 * Usage: bun test src/backend/core/simulation/actors/retain-memory-batch.test.ts
 * Related: src/backend/core/simulation/actors/retain-memory.ts, src/backend/core/simulation/roles/coordinator/nodes.ts
 */
import { expect, spyOn, test } from "bun:test"
import { defaultSettings } from "@/backend/core/settings/defaults"
import * as invocation from "@/backend/integrations/llm/invoke"
import { buildActor } from "../roles/generator/state"
import { applyInteractionContext } from "./memory"
import { applyMemoryUpdate, parseMemoryUpdate } from "./memory-records"
import { retainActorMemories } from "./retain-memory"
import { initialSimulationState } from "../workflow/state"
import { coordinatorNode } from "../roles/coordinator/nodes"

const scenario = { text: "A team reviews a release", controls: { numCast: 1, maxRound: 1, fastMode: false,
  actionsPerType: 1, allowAdditionalCast: false } }
const execution = { runId: "retain-run", scenario, settings: defaultSettings(), emit: async () => {} }
const noChanges = "0"
const promise = "I will deliver the revised budget tomorrow."
const added = { additions: [{ kind: "commitment", quote: promise }], closures: [] }

function actor() {
  return buildActor(1, { name: "Finance", role: "Finance owner", backgroundHistory: "Planning a release",
    personality: "Practical", preference: "A sound budget" }, "Meeting", {})
}
function result(text: string): invocation.RoleTextResult {
  return { text, metrics: { role: "actor", step: "context", attempt: 1, ttftMs: 0, durationMs: 0, inputTokens: 0,
    reasoningTokens: 0, outputTokens: 0, totalTokens: 0, tokenSource: "unavailable" }, diagnostics: { reasoningContentObserved: false, reasoningContent: "" } }
}

test("five public entries shared by four actors use five extraction calls and replay without calls", async () => {
  let actors = ["reader-1", "reader-2", "reader-3", "reader-4"].map(id => ({ ...actor(), id, name: id }))
  for (let index = 1; index <= 5; index++) actors = applyInteractionContext(actors, {
    id: `accepted-${index}`, roundIndex: index, sourceActorId: "outside", targetActorIds: [],
    actionType: "Discuss", content: `The team reviewed agenda item ${index}.`, eventId: "event-1",
    visibility: "public", decisionType: "action", thought: "private thought", intent: "SOURCE-ONLY-MOTIVE",
    expectation: "SOURCE-ONLY-EXPECTATION",
  })
  const prompts: string[] = []
  const model = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, prompt) => {
    prompts.push(prompt)
    return result(noChanges)
  })
  try {
    const retained = await retainActorMemories(actors, execution, false)
    expect(prompts.filter(prompt => prompt.includes("Shared accepted memory extraction."))).toHaveLength(5)
    expect(prompts.filter(prompt => prompt.includes("Actor retained memory."))).toHaveLength(0)
    expect(prompts).toHaveLength(5)
    expect(prompts.filter(prompt => prompt.includes("Shared accepted memory extraction."))
      .every(prompt => !prompt.includes("SOURCE-ONLY-MOTIVE") && !prompt.includes("SOURCE-ONLY-EXPECTATION"))).toBe(true)
    expect(retained.every(value => value.context.ledger?.processedCount === 5)).toBe(true)
    expect(await retainActorMemories(retained, execution, false)).toEqual(retained)
    expect(prompts).toHaveLength(5)
  } finally { model.mockRestore() }
})

test("shared additions reach only the accepted audience and retry once without exposing motives", async () => {
  const cast = ["speaker", "reader-1", "reader-2", "outsider"].map(id => ({ ...actor(), id, name: id }))
  const actors = applyInteractionContext(cast, {
    id: "private-accepted", roundIndex: 1, sourceActorId: "speaker", targetActorIds: ["reader-1", "reader-2"],
    actionType: "Promise", content: promise, eventId: "event-1", visibility: "private", decisionType: "action",
    thought: "hidden thought", intent: "hidden intent", expectation: "hidden expectation",
  })
  const prompts: string[] = []
  const model = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, prompt) => {
    prompts.push(prompt)
    if (prompt.includes("Field: addition-quote")) return result(prompt.includes('"acceptedQuotes"') ? noChanges
      : prompt.includes("Shared accepted memory extraction.") && prompts.filter(value => value.includes("Shared accepted memory extraction.")).length === 1
        ? "not in the entry" : promise)
    return result(noChanges)
  })
  const choice = spyOn(invocation, "invokeExactChoiceWithMetrics").mockResolvedValue(result("commitment"))
  try {
    const retained = await retainActorMemories(actors, execution, false)
    expect(prompts.filter(prompt => prompt.includes("Shared accepted memory extraction."))).toHaveLength(3)
    expect(prompts).toHaveLength(5)
    expect(prompts.filter(prompt => prompt.includes("Shared accepted memory extraction.")).every(prompt => !prompt.includes("hidden intent"))).toBe(true)
    expect(retained.slice(0, 3).map(value => value.context.ledger?.records[0]?.quote)).toEqual([promise, promise, promise])
    expect(retained[1]?.context.ledger?.records[0]?.id).not.toBe(retained[2]?.context.ledger?.records[0]?.id)
    expect(retained[3]?.context.visible).toEqual([])
    expect(retained[3]?.context.ledger).toBeUndefined()
  } finally { model.mockRestore(); choice.mockRestore() }
})

test("shared extraction keeps recipient-private records out of packets and closes only that recipient's record", async () => {
  const cast = ["speaker", "reader-1", "reader-2"].map(id => ({ ...actor(), id, name: id }))
  const privateEntry = { id: "private:reader-1", kind: "in" as const, roundIndex: 1,
    content: "I will deliver the revised budget tomorrow.", sourceActorId: "speaker" }
  cast[1]!.context.visible = [privateEntry]
  cast[1]!.context.ledger = applyMemoryUpdate(undefined, privateEntry,
    parseMemoryUpdate(added, privateEntry, []), "reader-1")
  const publicEntry = "I delivered the revised budget."
  const actors = applyInteractionContext(cast, {
    id: "public-accepted", roundIndex: 2, sourceActorId: "speaker", targetActorIds: [],
    actionType: "Update", content: publicEntry, eventId: "event-1", visibility: "public", decisionType: "action",
    thought: "hidden thought", intent: "hidden intent", expectation: "hidden expectation",
  })
  const prompts: string[] = []
  const model = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, prompt) => {
    prompts.push(prompt)
    if (prompt.includes("Field: closure-quote")) return result(publicEntry)
    return result(noChanges)
  })
  const choice = spyOn(invocation, "invokeExactChoiceWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, prompt) => {
    prompts.push(prompt)
    return result("1")
  })
  try {
    const retained = await retainActorMemories(actors, execution, false)
    expect(prompts.filter(prompt => prompt.includes("Shared accepted memory extraction."))).toHaveLength(1)
    expect(prompts.filter(prompt => prompt.includes("Recipient retained-memory closure."))).toHaveLength(2)
    expect(prompts).toHaveLength(4)
    expect(prompts.find(prompt => prompt.includes("Shared accepted memory extraction."))).not.toContain(promise)
    expect(prompts.filter(prompt => prompt.includes("Field: closure-record"))[0]).toContain('"index":1')
    expect(retained[1]?.context.ledger?.records[0]?.status).toBe("closed")
    expect(retained[2]?.context.ledger?.records).toEqual([])
  } finally { model.mockRestore(); choice.mockRestore() }
})

test("a prior private entry does not split later shared extraction across reader cursors", async () => {
  const cast = ["speaker", "reader-1", "reader-2"].map(id => ({ ...actor(), id, name: id }))
  const privateActors = applyInteractionContext(cast, {
    id: "first-private", roundIndex: 1, sourceActorId: "speaker", targetActorIds: ["reader-1"],
    actionType: "Discuss", content: "A confidential budget is under review.", eventId: "event-1",
    visibility: "private", decisionType: "action", thought: "", intent: "", expectation: "",
  })
  const actors = applyInteractionContext(privateActors, {
    id: "later-public", roundIndex: 1, sourceActorId: "speaker", targetActorIds: [],
    actionType: "Discuss", content: "The public launch remains on schedule.", eventId: "event-1",
    visibility: "public", decisionType: "action", thought: "", intent: "", expectation: "",
  })
  const prompts: string[] = []
  const model = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, prompt) => {
    prompts.push(prompt)
    return result(noChanges)
  })
  try {
    const retained = await retainActorMemories(actors, execution, false)
    expect(prompts.filter(prompt => prompt.includes("Shared accepted memory extraction."))).toHaveLength(1)
    expect(prompts.filter(prompt => prompt.includes("Actor retained memory."))).toHaveLength(3)
    expect(retained.map(value => value.context.ledger?.processedCount)).toEqual([2, 2, 1])
  } finally { model.mockRestore() }
})

test("coordinator accounts for five shared extractions, five source extractions and five compressions", async () => {
  const inputScenario = { ...scenario, controls: { ...scenario.controls, numCast: 5 } }
  const simulation = initialSimulationState(execution.runId, inputScenario)
  simulation.actors = [1, 2, 3, 4, 5].map(index => {
    const person = { ...actor(), id: `actor-${index}`, name: `Person ${index}` }
    person.actions = [{ id: `PUBLIC-${index}`, visibility: "public", label: "Announce",
      intentHint: "When ready", expectedOutcome: "Awareness" }]
    return person
  })
  const prompts: string[] = []
  const model = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, step, _attempt, prompt) => {
    prompts.push(prompt)
    if (prompt.includes("Shared accepted memory extraction.") || prompt.includes("Actor retained memory.")) return result(noChanges)
    return result(step === "message" ? "The launch review is ready." : step === "thought" ? "I should update the group."
      : step === "intent" ? "Share the review." : "The group reviewed the launch.")
  })
  const choice = spyOn(invocation, "invokeExactChoiceWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, _prompt, allowed) => result(allowed[0]!))
  try {
    const completed = await coordinatorNode({ ...execution, scenario: inputScenario, simulation }, async () => {})
    expect(completed.simulation?.interactions).toHaveLength(5)
    expect(prompts.filter(prompt => prompt.includes("Shared accepted memory extraction."))).toHaveLength(5)
    expect(prompts.filter(prompt => prompt.includes("Actor retained memory."))).toHaveLength(5)
    expect(prompts.filter(prompt => prompt.includes("Compress memory for the actor"))).toHaveLength(5)
    expect(completed.simulation?.actors.every(value => value.context.ledger?.processedCount === 5)).toBe(true)
  } finally { model.mockRestore(); choice.mockRestore() }
})

for (const fastMode of [false, true]) test(`recipient closure calls follow fast mode (${fastMode})`, async () => {
  const cast = ["speaker", "reader-1", "reader-2"].map(id => ({ ...actor(), id, name: id }))
  for (const reader of cast.slice(1)) {
    const entry = { id: `private:${reader.id}`, kind: "in" as const, roundIndex: 1,
      content: promise, sourceActorId: "speaker" }
    reader.context.visible = [entry]
    reader.context.ledger = applyMemoryUpdate(undefined, entry, parseMemoryUpdate(added, entry, []), reader.id)
  }
  const actors = applyInteractionContext(cast, {
    id: "shared-later", roundIndex: 2, sourceActorId: "speaker", targetActorIds: [],
    actionType: "Update", content: "The review remains open.", eventId: "event-1", visibility: "public",
    decisionType: "action", thought: "", intent: "", expectation: "",
  })
  let inFlight = 0
  let peak = 0
  let closureCalls = 0
  const model = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async () => {
    return result(noChanges)
  })
  const choice = spyOn(invocation, "invokeExactChoiceWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, prompt) => {
    if (prompt.includes("Field: closure-record")) {
      closureCalls++
      inFlight++
      peak = Math.max(peak, inFlight)
      await Promise.resolve()
      inFlight--
    }
    return result(noChanges)
  })
  try {
    const retained = await retainActorMemories(actors, execution, fastMode)
    expect(closureCalls).toBe(2)
    expect(peak).toBe(fastMode ? 2 : 1)
    expect(retained.slice(1).every(value => value.context.ledger?.records[0]?.status === "active")).toBe(true)
  } finally { model.mockRestore(); choice.mockRestore() }
})
