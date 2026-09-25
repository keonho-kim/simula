/**
 * Purpose: Verify independent world preparation preserves confirmed cast and private boundaries.
 * Pattern: Graph and simulation-handoff contract tests.
 * Usage: bun test src/backend/core/story-builder/world/graph.test.ts
 * Related: src/backend/core/story-builder/world/graph.ts, src/backend/core/story-builder/world/handoff.ts
 */
import { expect, test } from "bun:test"
import { specification, dependencies } from "./test-fixtures"
import { prepareWorldStory } from "./graph"
import { scenarioFromWorld } from "./handoff"
import { createGeneratorRosterNode, createGeneratorCardsNode } from "@/backend/core/simulation/roles/generator/nodes"
import { initialSimulationState } from "@/backend/core/simulation/workflow/state"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { createActorGraphState } from "@/backend/core/simulation/roles/actor/state"
import { createActorContext } from "@/backend/core/simulation/roles/actor/context"
import { actorPrompts } from "@/backend/core/simulation/roles/actor/prompts"
import { emptyCoordinatorTrace } from "@/backend/core/simulation/roles/coordinator/state"
import { renderWorldConstraints } from "@/backend/core/simulation/planning/world-constraints"
import { applyInteractionContext } from "@/backend/core/simulation/actors/memory"
import { preparedWorldActors } from "@/backend/core/simulation/roles/generator/prepared-world"

test("confirmed source grants reach only the entitled prepared actor until accepted disclosure", async () => {
  const secret = specification.sourceFacts[0]!.text
  const fixture = dependencies()
  const world = await prepareWorldStory(crypto.randomUUID(), specification, true, fixture.deps)
  expect(world.participants[0]?.knownSourceFacts).toEqual([])
  expect(world.participants[1]?.knownSourceFacts).toEqual([{ id: "fact-1", text: secret,
    evidenceIds: specification.sourceFacts[0]!.evidenceIds }])
  for (const id of ["opening-setting", "opening-summary", "opening-assumption", "actor-participant-1-summary", "agenda", "information"]) {
    expect(fixture.calls.find(call => call.id === id)?.prompt).not.toContain(secret)
  }
  expect(fixture.calls.find(call => call.id === "actor-participant-2-summary")?.prompt).not.toContain(secret)
  expect(fixture.calls.find(call => call.id === "concern-participant-2-goal")?.prompt).toContain(secret)
  const scenario = scenarioFromWorld(world, specification, {})
  expect(scenario.text).not.toContain(secret)
  const actors = preparedWorldActors(world, {})
  expect(actors[0]?.knownSourceFacts).toEqual([])
  expect(actors[1]?.knownSourceFacts?.[0]?.text).toBe(secret)
  const thought = (index: number, currentActors = actors) => actorPrompts.thought({ ...createActorContext({
    runId: "source-grant-run", scenario, plannerDigest: "Public investment review", actor: currentActors[index]!,
    actors: currentActors, event: { id: "event", title: "Review", summary: "Public review", status: "active", participantIds: [] },
    roundDigest: { roundIndex: 1, preRound: { elapsedTime: "0", content: "Review begins" } }, roundIndex: 1,
    coordinatorTrace: emptyCoordinatorTrace() }), ...createActorGraphState() }, {})
  expect(thought(0)).not.toContain(secret)
  expect(thought(1)).toContain(secret)
  const disclosed = applyInteractionContext(actors, { id: "private-disclosure", roundIndex: 1,
    sourceActorId: actors[1]!.id, targetActorIds: [actors[0]!.id], actionType: "Inform", content: secret,
    eventId: "event", visibility: "private", decisionType: "action", thought: "Private thought",
    intent: "Tell CTO", expectation: "CTO can review" })
  expect(thought(0, disclosed)).toContain(secret)
  expect(thought(0)).not.toContain(secret)
  const changed = structuredClone(world)
  changed.participants[0]!.knownSourceFacts = structuredClone(world.participants[1]!.knownSourceFacts)
  expect(() => scenarioFromWorld(changed, specification, {})).toThrow("source facts")
})

test("world graphs independently generate openings while preserving all confirmed participants", async () => {
  const first = dependencies(), second = dependencies()
  const ids = [crypto.randomUUID(), crypto.randomUUID()]
  const before = structuredClone(specification)
  const [a, b] = await Promise.all([
    prepareWorldStory(ids[0], specification, false, first.deps),
    prepareWorldStory(ids[1], specification, true, second.deps),
  ])
  expect(a.id).not.toBe(b.id)
  expect(first.calls.filter(call => call.id === "opening-setting" || call.id === "opening-summary")).toHaveLength(2)
  expect(second.calls.filter(call => call.id === "opening-setting" || call.id === "opening-summary")).toHaveLength(2)
  expect(a.participants.map(value => value.name)).toEqual(["CTO", "Finance"])
  expect(a.participants[0].personality).toBe("Requires evidence.")
  expect(b.participants[1].personality).toBe("Tests assumptions carefully.")
  expect(specification).toEqual(before)
  expect(first.calls.every(call => call.maxOutputTokens === 2_048)).toBe(true)
  const count = first.calls.length
  expect(await prepareWorldStory(ids[0], specification, false, first.deps)).toEqual(a)
  expect(first.calls.length).toBe(count)
})

test("world fields are accepted as short text before code assembles the opening and actor records", async () => {
  const fixture = dependencies()
  const world = await prepareWorldStory(crypto.randomUUID(), specification, false, fixture.deps)
  expect(world.opening).toMatchObject({ setting: "A meeting room.", summary: "Participants begin reviewing the proposal." })
  expect(world.participants[0]?.initialPosition).toBe("Asks to review evidence.")
  expect(fixture.calls.map(call => call.id)).toContain("opening-setting")
  expect(fixture.calls.map(call => call.id)).toContain("opening-summary")
  expect(fixture.calls.filter(call => call.id.startsWith("opening-") || call.id.endsWith("-summary") || call.id.endsWith("-goal"))
    .every(call => !call.prompt.includes("Required JSON shape"))).toBe(true)
})

test("a realized optional opening detail remains an explicit world assumption", async () => {
  const fixture = dependencies()
  const original = fixture.deps.invoke
  fixture.deps.invoke = async call => call.id === "opening-assumption"
    ? { text: "The discussion starts before the decision window.", truncated: false }
    : original(call)
  const world = await prepareWorldStory(crypto.randomUUID(), specification, false, fixture.deps)
  expect(world.opening.assumptions).toEqual(["The discussion starts before the decision window."])
  expect(world.assumptions).toContain("The discussion starts before the decision window.")
})

test("Generator uses prepared identities without model calls and keeps concerns out of public profiles", async () => {
  const fixture = dependencies()
  const world = await prepareWorldStory(crypto.randomUUID(), specification, true, fixture.deps)
  const scenario = scenarioFromWorld(world, specification, { maxRound: 1, actionsPerType: 1 })
  expect(scenario.text).not.toContain("PRIVATE-")
  expect(scenario.controls.numCast).toBe(2)
  const simulation = initialSimulationState("test-world-run", scenario)
  simulation.plan = { interpretation: "Review", backgroundStory: "Public opening", majorEvents: [], actionCatalog: {
    SOL01: { id: "SOL01", visibility: "solitary", label: "Review", intentHint: "When uncertain", expectedOutcome: "A clearer position" },
  } }
  const state = { runId: simulation.runId, scenario, settings: defaultSettings(), simulation }
  const roster = await createGeneratorRosterNode(async () => {})(state)
  const generated = await createGeneratorCardsNode(async () => {})({ ...state, simulation: roster.simulation ?? simulation })
  expect(generated.simulation?.actors.map(actor => actor.name)).toEqual(["CTO", "Finance"])
  expect(generated.simulation?.actors[0].personality).toBe("Requires evidence.")
  expect(generated.simulation?.actors[0].privateGoal).toContain("PRIVATE-concern-participant-1")
  expect(generated.simulation?.actors[0].contextSummary).toContain("PRIVATE-concern-participant-1")
  expect(generated.simulation?.actors[1].contextSummary).not.toContain("PRIVATE-concern-participant-1")
  expect(generated.simulation?.actors[0].backgroundHistory).not.toContain("PRIVATE-")
  const actors = generated.simulation?.actors ?? []
  const laterActor = { ...actors[1], contextSummary: "A later summary omits the initial concern." }
  const actorState = { ...createActorContext({ runId: state.runId, scenario,
    plannerDigest: "The public investment review is starting.", actor: laterActor, actors: [actors[0], laterActor],
    event: { id: "event-1", title: "Review", summary: "Discuss the proposal.", status: "active", participantIds: [] },
    roundDigest: { roundIndex: 1, preRound: { elapsedTime: "0", content: "The review starts." } }, roundIndex: 1, coordinatorTrace: emptyCoordinatorTrace() }), ...createActorGraphState() }
  expect(actorPrompts.thought(actorState, {})).toContain("PRIVATE-concern-participant-2")
  expect(actorPrompts.thought(actorState, {})).not.toContain("PRIVATE-concern-participant-1")
  expect(actorPrompts.target(actorState, { action: "SOL01" })).not.toContain("PRIVATE-concern-participant-1")
  expect(renderWorldConstraints(world)).not.toContain("PRIVATE-")
})

test("unconfirmed scenarios cannot start world preparation", async () => {
  const fixture = dependencies()
  await expect(prepareWorldStory(crypto.randomUUID(), { ...specification, status: "review" }, true, fixture.deps)).rejects.toThrow("confirmed")
  expect(fixture.calls).toHaveLength(0)
})
