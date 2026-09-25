/**
 * Purpose: Verify actor round batching follows the configured causal ordering policy.
 * Pattern: Policy contract test.
 * Usage: Executed by bun test.
 * Related: src/backend/core/simulation/roles/coordinator/actor-round.ts
 */
import { expect, spyOn, test } from "bun:test"
import type { ActorState } from "@/shared"
import { actorExecutionBatches, runActorRound } from "./actor-round"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { initialSimulationState } from "../../workflow/state"
import { emptyCoordinatorTrace } from "./state"
import * as invocation from "@/backend/integrations/llm/invoke"

const actors = [actor("first"), actor("second"), actor("third")]

test("normal mode exposes each actor as one causal batch", () => {
  expect(actorExecutionBatches(actors, false).map((batch) => batch.map((item) => item.id))).toEqual([
    ["first"],
    ["second"],
    ["third"],
  ])
})

test("fast mode evaluates all actors against one shared snapshot", () => {
  expect(actorExecutionBatches(actors, true)).toEqual([actors])
})

function actor(id: string): ActorState {
  return {
    id,
    name: id,
    role: "role",
    backgroundHistory: "history",
    personality: "personality",
    preference: "preference",
    privateGoal: "goal",
    intent: "intent",
    actions: [],
    context: { visible: [] },
    contextSummary: "",
    memory: [],
    relationships: {},
  }
}

function response(text: string): invocation.RoleTextResult {
  return { text, metrics: { role: "actor", step: "thought", attempt: 1, ttftMs: 0, durationMs: 0,
    inputTokens: 0, reasoningTokens: 0, outputTokens: 0, totalTokens: 0, tokenSource: "unavailable" },
  diagnostics: { reasoningContentObserved: false, reasoningContent: "" } }
}

for (const fastMode of [false, true]) test(`later actors receive prior accepted speech only in sequential mode (${fastMode})`, async () => {
  const scenario = { text: "A team discusses a release.", controls: { numCast: 2, maxRound: 1, actionsPerType: 1, fastMode, allowAdditionalCast: false } }
  const simulation = initialSimulationState("causal-round", scenario)
  const cast = [1, 2].map(index => ({
    ...actor(`actor-${index}`), actions: [{ id: `action-${index}`, visibility: "public" as const, label: "Ask", intentHint: "When unclear", expectedOutcome: "Clarity" }],
  }))
  const thoughts: string[] = []
  const text = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, step, _attempt, prompt) => {
    if (step === "thought") thoughts.push(prompt)
    return response(step === "thought" ? "I need evidence." : step === "intent" ? "Request clarity." : "FIRST-ACTOR-SIGNAL")
  })
  const choice = spyOn(invocation, "invokeExactChoiceWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, _prompt, allowed) => response(allowed[0]!))
  try {
    const round = await runActorRound({ runId: simulation.runId, scenario, settings: defaultSettings(), simulation }, cast,
      { id: "event", title: "Review", summary: "Clarify next steps.", status: "active", participantIds: [] },
      { roundIndex: 1, preRound: { elapsedTime: "0", content: "The review begins." } }, 1, emptyCoordinatorTrace(), async () => {})
    expect(thoughts).toHaveLength(2)
    expect(thoughts[0]).not.toContain("FIRST-ACTOR-SIGNAL")
    expect(thoughts[1]?.includes("FIRST-ACTOR-SIGNAL")).toBe(!fastMode)
    expect(thoughts[1]).not.toContain("Request clarity.")
    expect(round.interactions[0]?.intent).toBe("Request clarity.")
    expect(round.interactions.map(interaction => interaction.sourceActorId)).toEqual(cast.map(value => value.id))
    expect(cast[1]?.context.visible).toEqual([])
  } finally { text.mockRestore(); choice.mockRestore() }
})
