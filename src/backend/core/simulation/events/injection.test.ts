/**
 * Purpose: Verify scoped event details reach only permitted actors until accepted disclosure.
 * Pattern: Visibility and model-input contract tests.
 * Usage: bun test src/backend/core/simulation/events/injection.test.ts
 * Related: src/backend/core/simulation/events/injection.ts, src/backend/core/simulation/actors/memory.ts
 */
import { expect, spyOn, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { defaultSettings } from "@/backend/core/settings/defaults"
import * as invocation from "@/backend/integrations/llm/invoke"
import { initialSimulationState } from "../workflow/state"
import { RunStore } from "@/backend/storage/runs/run-store"
import { seedRunState } from "@/backend/storage/runs/testing/fixtures"
import { buildActor } from "../roles/generator/state"
import { emptyCoordinatorTrace } from "../roles/coordinator/state"
import { createActorContext } from "../roles/actor/context"
import { createActorGraphState } from "../roles/actor/state"
import { actorPrompts } from "../roles/actor/prompts"
import { applyInjectedEventContext, applyInteractionContext, actorPromptContext, compressActorContext } from "../actors/memory"
import { buildInteraction } from "../actors/interactions"
import { buildPreRoundDigest, continuityEvent, injectedEventForRound } from "./injection"

const secret = "ONLY-FINANCE-KNOWS-THE-BUDGET-FREEZE"
const scenario = { text: "A public release review", controls: { numCast: 3, maxRound: 2,
  fastMode: false, actionsPerType: 1, allowAdditionalCast: false } }

function cast() {
  return ["Finance", "CTO", "Observer"].map((name, index) => buildActor(index + 1,
    { name, role: "Reviewer", backgroundHistory: "Public preparation", personality: "Careful",
      preference: "A sound release" }, "Public review", {}))
}

function scopedEvent() {
  return { id: "budget-freeze", title: secret, summary: `${secret} applies tomorrow.`,
    status: "pending" as const, participantIds: ["actor-1"], visibleToActorIds: ["actor-1"] }
}

test("scoped injection excludes other actors from memory, thought packets and fallback interaction text", () => {
  const actors = cast()
  const planned = scopedEvent()
  const event = injectedEventForRound(1, planned, actors)
  const updated = applyInjectedEventContext(actors, event)
  expect(updated[0]?.context.visible[0]?.content).toContain(secret)
  expect(updated[1]?.context.visible).toEqual([])
  expect(updated[2]?.context.visible).toEqual([])
  const roundDigest = buildPreRoundDigest(1, event)
  const input = { runId: "private-event-run", scenario, plannerDigest: "Public planning digest", actors: updated,
    event: planned, roundDigest, roundIndex: 1, coordinatorTrace: emptyCoordinatorTrace() }
  const owner = createActorContext({ ...input, actor: updated[0]! })
  const excluded = createActorContext({ ...input, actor: updated[1]! })
  const ownerPacket = actorPrompts.thought({ ...owner, ...createActorGraphState() }, {})
  const excludedState = { ...excluded, ...createActorGraphState() }
  expect(ownerPacket).toContain(secret)
  for (const prompt of Object.values(actorPrompts)) expect(prompt(excludedState, {})).not.toContain(secret)
  expect(JSON.stringify(excluded)).not.toContain(secret)
  const interaction = buildInteraction(1, planned, updated[1]!, updated, {
    actorId: "actor-2", decisionType: "no_action", visibility: "solitary", targetActorIds: [],
    intent: "Wait for a public update.", expectation: "Nothing changes.", contextUsed: [],
  })
  expect(interaction.content).not.toContain(secret)
})

test("accepted private then public speech grants event information only at each disclosure", () => {
  const actors = applyInjectedEventContext(cast(), injectedEventForRound(1, scopedEvent(), cast()))
  const privateDisclosure = applyInteractionContext(actors, {
    id: "accepted-private", roundIndex: 1, sourceActorId: "actor-1", targetActorIds: ["actor-2"],
    actionType: "Inform", content: secret, eventId: "budget-freeze", visibility: "private",
    decisionType: "action", thought: "Unspoken private reason", intent: "Inform CTO", expectation: "Review",
  })
  expect(actorPromptContext(privateDisclosure[1]!)).toContain(secret)
  expect(actorPromptContext(privateDisclosure[2]!)).not.toContain(secret)
  const thoughtPacket = (actorIndex: number, currentActors: ReturnType<typeof cast>) => {
    const context = createActorContext({ runId: "disclosure-run", scenario, plannerDigest: "Public planning digest",
      actor: currentActors[actorIndex]!, actors: currentActors, event: continuityEvent(2),
      roundDigest: { roundIndex: 2, preRound: { elapsedTime: "Later", content: "Public review continues." } },
      roundIndex: 2, coordinatorTrace: emptyCoordinatorTrace() })
    return actorPrompts.thought({ ...context, ...createActorGraphState() }, {})
  }
  expect(thoughtPacket(1, privateDisclosure)).toContain(secret)
  expect(thoughtPacket(2, privateDisclosure)).not.toContain(secret)
  const publicDisclosure = applyInteractionContext(privateDisclosure, {
    id: "accepted-public", roundIndex: 2, sourceActorId: "actor-2", targetActorIds: [],
    actionType: "Announce", content: secret, eventId: "budget-freeze", visibility: "public",
    decisionType: "action", thought: "Unspoken reason", intent: "Inform everyone", expectation: "Review",
  })
  expect(actorPromptContext(publicDisclosure[2]!)).toContain(secret)
  expect(thoughtPacket(2, publicDisclosure)).toContain(secret)
  expect(actors[2]?.context.visible).toEqual([])
})

test("scoped event never enters an excluded actor's compression request", async () => {
  const actors = applyInjectedEventContext(cast(), injectedEventForRound(1, scopedEvent(), cast()))
  const prompts: string[] = []
  const model = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, prompt) => {
    prompts.push(prompt)
    return { text: prompt.includes("Actor retained memory.") ? '{"additions":[],"closures":[]}' : "The review continues.",
      metrics: { role: "actor", step: "context", attempt: 1, ttftMs: 0, durationMs: 0,
        inputTokens: 0, reasoningTokens: 0, outputTokens: 0, totalTokens: 0, tokenSource: "unavailable" },
      diagnostics: { reasoningContentObserved: false, reasoningContent: "" } }
  })
  try {
    await compressActorContext(actors[1]!, { runId: "private-event-run", scenario, settings: defaultSettings(),
      roundIndex: 1, emit: async () => {} })
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).not.toContain(secret)
    await compressActorContext(actors[0]!, { runId: "private-event-run", scenario, settings: defaultSettings(),
      roundIndex: 1, emit: async () => {} })
    expect(prompts.some(prompt => prompt.includes(secret))).toBe(true)
  } finally { model.mockRestore() }
})

test("injection rejects empty, duplicate and unknown explicit audiences", () => {
  const actors = cast()
  for (const visibleToActorIds of [[], ["actor-1", "actor-1"], ["foreign"]]) {
    expect(() => injectedEventForRound(1, { ...scopedEvent(), visibleToActorIds }, actors)).toThrow("audience")
  }
})

test("two worlds with the same event ID keep independent audiences and actor histories", () => {
  const first = cast()
  const second = cast()
  const firstEvent = injectedEventForRound(1, scopedEvent(), first)
  const secondEvent = injectedEventForRound(1, { ...scopedEvent(), visibleToActorIds: ["actor-2"] }, second)
  const firstWorld = applyInjectedEventContext(first, firstEvent)
  const secondWorld = applyInjectedEventContext(second, secondEvent)
  expect(firstWorld.map(actor => actor.context.visible.length)).toEqual([1, 0, 0])
  expect(secondWorld.map(actor => actor.context.visible.length)).toEqual([0, 1, 0])
  expect(first.every(actor => actor.context.visible.length === 0)).toBe(true)
  expect(second.every(actor => actor.context.visible.length === 0)).toBe(true)
})

test("run-state reopen keeps event audience and later-round actor visibility", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "simula-event-audience-"))
  try {
    const store = new RunStore({ rootDir })
    const run = await store.createRun(scenario)
    const state = initialSimulationState(run.id, scenario)
    const planned = scopedEvent()
    const injected = injectedEventForRound(1, planned, cast())
    state.plan = { interpretation: "Public review", backgroundStory: "Public review",
      actionCatalog: {}, majorEvents: [planned] }
    state.actors = applyInjectedEventContext(cast(), injected)
    state.roundDigests = [buildPreRoundDigest(1, injected)]
    await seedRunState(store, state)
    const restored = await new RunStore({ rootDir }).readState(run.id)
    const event = restored?.plan?.majorEvents[0]
    const digest = restored?.roundDigests[0]
    const owner = restored?.actors[0]
    const excluded = restored?.actors[1]
    if (!restored || !event || !digest || !owner || !excluded) throw new Error("Stored event fixture is incomplete.")
    expect(event.visibleToActorIds).toEqual(["actor-1"])
    expect(owner.context.visible[0]?.content).toContain(secret)
    expect(excluded.context.visible).toEqual([])
    const context = createActorContext({ runId: run.id, scenario, plannerDigest: "Public planning digest",
      actor: excluded, actors: restored.actors, event, roundDigest: digest, roundIndex: 2,
      coordinatorTrace: emptyCoordinatorTrace() })
    expect(actorPrompts.thought({ ...context, ...createActorGraphState() }, {})).not.toContain(secret)
  } finally { await rm(rootDir, { recursive: true, force: true }) }
})
