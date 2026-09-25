/**
 * Purpose: Verify actor graph working context excludes unrelated history, source bodies and provider settings.
 * Pattern: Projection and graph-state contract tests.
 * Usage: bun test src/backend/core/simulation/roles/actor/context.test.ts
 * Related: src/backend/core/simulation/roles/actor/context.ts, src/backend/core/simulation/roles/actor/state.ts
 */
import { expect, spyOn, test } from "bun:test"
import { buildDigestSimulation } from "../../../../../../packages/core/tests/scenario-fixtures"
import { defaultSettings } from "@/backend/core/settings/defaults"
import * as invocation from "@/backend/integrations/llm/invoke"
import { emptyCoordinatorTrace } from "../coordinator/state"
import { actorPromptContext, compressActorContext, contextUsedByActor } from "../../actors/memory"
import { createActorContext } from "./context"
import { createActorGraphState } from "./state"
import { actorPrompts } from "./prompts"

test("actor working context preserves visible memory while excluding source bodies and peer private state", () => {
  const simulation = buildDigestSimulation()
  const actor = simulation.actors[0]!
  actor.context.visible = Array.from({ length: 10_000 }, (_, index) => ({ id: `e-${index}`, kind: "event", roundIndex: index,
    eventId: `event-${index}`, content: "Visible event evidence. ".repeat(5) }))
  const peer = { ...actor, id: "peer", name: "Peer", privateGoal: "PEER-PRIVATE", contextSummary: "PEER-MEMORY", memory: ["PEER-HISTORY"] }
  simulation.scenario.text = "Original material. ".repeat(20_000)
  const context = createActorContext({ runId: "run", scenario: simulation.scenario, plannerDigest: "Planner digest", actor, actors: [actor, peer],
    event: { id: "e", title: "Event", summary: "Event summary", status: "active", participantIds: [] },
    roundIndex: 1, roundDigest: { roundIndex: 1, preRound: { elapsedTime: "0", content: "Pre-round" } }, coordinatorTrace: emptyCoordinatorTrace() })
  expect(context.history).toBe(actorPromptContext(actor, simulation.scenario.controls))
  expect(context.contextUsed).toEqual(contextUsedByActor(actor))
  expect(context.actor.actions).toEqual(actor.actions)
  const body = JSON.stringify(context)
  expect(body).not.toContain("Original material.")
  expect(body).not.toContain("PEER-PRIVATE")
  expect(body).not.toContain("PEER-MEMORY")
  expect(body).not.toContain("PEER-HISTORY")
  expect(body.length).toBeLessThan(20_000)
  const graph = createActorGraphState()
  expect(Object.keys(graph)).toEqual(["trace"])
  expect(JSON.stringify(graph).length).toBeLessThan(500)
  const before = context.actor.actions.map(action => action.label)
  if (actor.actions[0]) actor.actions[0].label = "Later mutation"
  expect(context.actor.actions.map(action => action.label)).toEqual(before)
})

test("initial private concern survives actual compression in the owner's later thought packet only", async () => {
  const simulation = buildDigestSimulation()
  const original = simulation.actors[0]!
  original.privateGoal = "ONLY-ACTOR-PRIVATE-CONCERN"
  const model = spyOn(invocation, "invokeRoleTextWithMetrics").mockResolvedValue({
    text: "A later summary omits the initial concern.",
    metrics: { role: "actor", step: "context", attempt: 1, ttftMs: 0, durationMs: 0,
      inputTokens: 0, reasoningTokens: 0, outputTokens: 0, totalTokens: 0, tokenSource: "unavailable" },
    diagnostics: { reasoningContentObserved: false, reasoningContent: "" },
  })
  try {
    const actor = await compressActorContext(structuredClone(original), { runId: "later-round",
      scenario: simulation.scenario, settings: defaultSettings(), roundIndex: 29, emit: async () => {} })
    expect(model).toHaveBeenCalledTimes(1)
    expect(actor.contextSummary).toBe("A later summary omits the initial concern.")
    const peer = { ...structuredClone(actor), id: "peer", name: "Peer",
      privateGoal: "ONLY-PEER-PRIVATE-CONCERN", contextSummary: "Peer's own later summary." }
    const input = { runId: "later-round", scenario: simulation.scenario, plannerDigest: "Shared public digest",
      actors: [actor, peer], event: { id: "event", title: "Review", summary: "Public review.",
        status: "active" as const, participantIds: [] },
      roundIndex: 30, roundDigest: { roundIndex: 30, preRound: { elapsedTime: "Later", content: "Public pressure." } },
      coordinatorTrace: emptyCoordinatorTrace() }
    const own = createActorContext({ ...input, actor })
    const peerContext = createActorContext({ ...input, actor: peer })
    const ownPacket = actorPrompts.thought({ ...own, ...createActorGraphState() }, {})
    const peerPacket = actorPrompts.thought({ ...peerContext, ...createActorGraphState() }, {})
    expect(ownPacket).toContain("ONLY-ACTOR-PRIVATE-CONCERN")
    expect(ownPacket).not.toContain("ONLY-PEER-PRIVATE-CONCERN")
    expect(peerPacket).toContain("ONLY-PEER-PRIVATE-CONCERN")
    expect(peerPacket).not.toContain("ONLY-ACTOR-PRIVATE-CONCERN")
    expect(actor.contextSummary).not.toContain(actor.privateGoal)
  } finally { model.mockRestore() }
})
