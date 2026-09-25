/**
 * Purpose: Verify compact card graph channels, per-card dependency isolation and retry stream replacement.
 * Pattern: Graph contract test with controlled model output.
 * Usage: bun test src/backend/core/simulation/roles/generator/cards/graph.test.ts
 * Related: src/backend/core/simulation/roles/generator/cards/graph.ts, src/backend/core/simulation/roles/generator/cards/node.ts
 */
import { expect, spyOn, test } from "bun:test"
import type { RunEvent } from "@/shared"
import { defaultSettings } from "@/backend/core/settings/defaults"
import * as invocation from "@/backend/integrations/llm/invoke"
import { testPromptBlock } from "@/backend/integrations/llm/testing/prompt-input"
import { createActorCardGraph } from "./graph"
import { completeActorCard, initialActorCardState } from "./state"
import type { ActorCardExecution } from "./context"

test("parallel card graphs keep callbacks and providers outside state while retaining sequential fields and retry replacement", async () => {
  const calls = new Map<string, string[]>()
  const spy = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (settings, _role, step, attempt, prompt, onDelta) => {
    const model = settings.roles.generator.model
    calls.set(model, [...(calls.get(model) ?? []), step])
    const actor = String(testPromptBlock(prompt, "ACTOR"))
    expect(actor).toContain(model === "one" ? "CTO" : "Finance")
    if (step === "backgroundHistory") expect(actor).toContain(`${model} role`)
    if (step === "preference") expect(String(testPromptBlock(prompt, "PREVIOUS_RESULT"))).toContain(`${model} personality`)
    expect(prompt).not.toContain("LATER-ROSTER-MUTATION")
    const invalid = model === "one" && step === "role" && attempt === 1
    const text = invalid ? "" : `${model} ${step}`
    await onDelta?.(invalid ? "REJECTED DRAFT" : text)
    return { text, metrics: { role: "generator", step, attempt, ttftMs: 0, durationMs: 0, inputTokens: 0,
      reasoningTokens: 0, outputTokens: 0, totalTokens: 0, tokenSource: "unavailable" },
    diagnostics: { reasoningContentObserved: false, reasoningContent: "" } }
  })
  try {
    const results = await Promise.all(["one", "two"].map(async (model, index) => {
      const settings = defaultSettings()
      settings.roles.generator.model = model
      settings.providers.openai.apiKey = "TEST-ONLY-SECRET"
      const events: RunEvent[] = []
      const context = { runId: `run-${model}`, language: "en" as const, actorIndex: index + 1,
        assignedName: index === 0 ? "CTO" : "Finance", roleSeed: "Decision owner", plannerDigest: "Review an investment.",
        fullRoster: [{ index: 1, name: "CTO", roleSeed: "Technology" }, { index: 2, name: "Finance", roleSeed: "Budget" }] }
      const execution: ActorCardExecution = { context, settings, emit: async event => { events.push(event) } }
      const graph = createActorCardGraph(execution)
      context.fullRoster[0]!.name = "LATER-ROSTER-MUTATION"
      let latest = initialActorCardState()
      for await (const state of await graph.stream(initialActorCardState(), { streamMode: "values" })) {
        expect(Object.keys(state).sort()).toEqual(["card", "retryCounts"])
        expect(JSON.stringify(state)).not.toContain("TEST-ONLY-SECRET")
        latest = state
      }
      expect(events.every(event => event.runId === context.runId)).toBe(true)
      const previews = events.filter(event => event.type === "board.updated" && event.update.kind === "preview" && event.update.field === "role")
        .flatMap(event => event.type === "board.updated" && event.update.kind === "preview" ? [event.update] : [])
      expect(new Set(previews.map(update => update.streamId)).size).toBe(index === 0 ? 2 : 1)
      expect(previews.filter(update => update.sequence === 0).every(update => update.content === "")).toBe(true)
      expect(latest.retryCounts.role).toBe(index === 0 ? 1 : 0)
      return completeActorCard(latest, context.assignedName)
    }))
    expect(results.map(card => card.name)).toEqual(["CTO", "Finance"])
    expect(results.map(card => card.preference)).toEqual(["one preference", "two preference"])
    expect(calls.get("one")).toEqual(["role", "role", "backgroundHistory", "personality", "preference"])
    expect(calls.get("two")).toEqual(["role", "backgroundHistory", "personality", "preference"])
  } finally { spy.mockRestore() }
})
