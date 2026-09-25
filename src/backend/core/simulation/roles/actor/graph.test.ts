/**
 * Purpose: Verify actual actor graph channels exclude runtime dependencies and isolate concurrent decisions.
 * Pattern: Graph execution contract test with controlled model outputs.
 * Usage: bun test src/backend/core/simulation/roles/actor/graph.test.ts
 * Related: src/backend/core/simulation/roles/actor/graph.ts, src/backend/core/simulation/roles/actor/state.ts
 */
import { expect, spyOn, test } from "bun:test"
import { buildActorChoiceState } from "../../../../../../packages/core/tests/scenario-fixtures"
import { defaultSettings } from "@/backend/core/settings/defaults"
import * as invocation from "@/backend/integrations/llm/invoke"
import { createActorGraph } from "./graph"
import { createActorGraphState } from "./state"

function result(text: string): invocation.RoleTextResult {
  return { text, metrics: { role: "actor", step: "thought", attempt: 1, ttftMs: 0, durationMs: 0, inputTokens: 0,
    reasoningTokens: 0, outputTokens: 0, totalTokens: 0, tokenSource: "unavailable" },
  diagnostics: { reasoningContentObserved: false, reasoningContent: "" } }
}

test("actor graph streams only per-turn state and keeps parallel actor contexts separate", async () => {
  const first = buildActorChoiceState()
  const second = { ...first, actor: { ...first.actor, id: "actor-2", name: "Second actor" } }
  const settings = defaultSettings()
  settings.providers.openai.apiKey = "TEST-ONLY-PROVIDER-SECRET"
  const text = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (received, _role, step) => {
    expect(received).toBe(settings)
    return result(step === "thought" ? "I need clearer evidence." : "Wait for the missing evidence.")
  })
  const choice = spyOn(invocation, "invokeExactChoiceWithMetrics").mockResolvedValue(result("no_action"))
  try {
    const outputs = await Promise.all([first, second].map(async context => {
      const values = []
      for await (const state of await createActorGraph(context, settings, async () => {}).stream(createActorGraphState(), { streamMode: "values" })) {
        expect(Object.keys(state).every(key => key === "trace" || key === "decision")).toBe(true)
        expect(JSON.stringify(state)).not.toContain("TEST-ONLY-PROVIDER-SECRET")
        values.push(state)
      }
      return values.at(-1)
    }))
    expect(outputs.map(value => value?.decision?.actorId)).toEqual([first.actor.id, second.actor.id])
    expect(outputs[0]?.decision?.contextUsed).toEqual(first.contextUsed)
    expect(outputs.every(value => value?.decision?.decisionType === "no_action")).toBe(true)
    expect(first.trace.thought).toBe("")
    expect(choice).toHaveBeenCalledTimes(2)
  } finally { text.mockRestore(); choice.mockRestore() }
})
