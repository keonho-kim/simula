/**
 * Purpose: Verify accepted interactions preserve private motives in actor-specific memory.
 * Pattern: Visibility and model-input contract tests.
 * Usage: bun test src/backend/core/simulation/actors/memory.test.ts
 * Related: src/backend/core/simulation/actors/memory.ts, src/backend/core/simulation/roles/generator/state.ts
 */
import { expect, spyOn, test } from "bun:test"
import type { ActionVisibility, Interaction } from "@/shared"
import { defaultSettings } from "@/backend/core/settings/defaults"
import * as invocation from "@/backend/integrations/llm/invoke"
import { buildActor } from "../roles/generator/state"
import { actorPromptContext, applyInteractionContext, compressActorContext, contextUsedByActor } from "./memory"

function cast() {
  return [1, 2, 3, 4].map(index => buildActor(index, { name: `Person ${index}`, role: "Reviewer",
    backgroundHistory: "Preparing a meeting", personality: "Practical", preference: "A clear decision" }, "Meeting", {}))
}

function accepted(visibility: ActionVisibility): Interaction {
  const targetActorIds = visibility === "solitary" ? [] : visibility === "private" ? ["actor-2"] : ["actor-2", "actor-3"]
  return { id: "accepted-1", roundIndex: 1, sourceActorId: "actor-1", targetActorIds,
    actionType: "Ask", content: "Please review the proposal.", eventId: "event-1", visibility, decisionType: "action",
    thought: "PRIVATE-THOUGHT", intent: "PRIVATE-MOTIVE", expectation: "PRIVATE-EXPECTATION" }
}

for (const visibility of ["public", "semi-public", "private", "solitary"] as const) {
  test(`${visibility} interaction exposes speech only to its audience and motives only to its author`, () => {
    const actors = cast()
    const interaction = accepted(visibility)
    const original = structuredClone(interaction)
    const updated = applyInteractionContext(actors, interaction)
    expect(updated[0]?.context.visible[0]?.content).toContain("PRIVATE-MOTIVE")
    expect(updated[0]?.context.visible[0]?.content).toContain("PRIVATE-EXPECTATION")
    for (const peer of updated.slice(1)) {
      const canRead = visibility !== "solitary" && (visibility === "public" || interaction.targetActorIds.includes(peer.id))
      expect(peer.context.visible).toHaveLength(canRead ? 1 : 0)
      if (canRead) expect(peer.context.visible[0]?.content).toBe(interaction.content)
      const inputs = JSON.stringify({ visible: peer.context.visible, memory: peer.memory,
        history: actorPromptContext(peer), used: contextUsedByActor(peer) })
      expect(inputs.includes(interaction.content)).toBe(canRead)
      expect(inputs).not.toContain("PRIVATE-MOTIVE")
      expect(inputs).not.toContain("PRIVATE-EXPECTATION")
      expect(inputs).not.toContain("PRIVATE-THOUGHT")
    }
    expect(actors.every(actor => actor.context.visible.length === 0)).toBe(true)
    expect(interaction).toEqual(original)
  })
}

test("memory compression never receives another actor's private motive or expectation", async () => {
  const actors = applyInteractionContext(cast(), accepted("public"))
  const inputs: string[] = []
  const model = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, _attempt, prompt) => {
    if (!prompt.includes("Actor retained memory.")) inputs.push(prompt)
    return { text: prompt.includes("Actor retained memory.") ? "0" : "I received a request to review the proposal.", metrics: { role: "actor", step: "context", attempt: 1,
      ttftMs: 0, durationMs: 0, inputTokens: 0, reasoningTokens: 0, outputTokens: 0, totalTokens: 0, tokenSource: "unavailable" },
    diagnostics: { reasoningContentObserved: false, reasoningContent: "" } }
  })
  try {
    const scenario = { text: "Review a proposal", controls: { numCast: 4, maxRound: 1, actionsPerType: 1,
      fastMode: false, allowAdditionalCast: false } }
    for (const actor of actors) await compressActorContext(actor, { runId: "memory-run", scenario,
      settings: defaultSettings(), roundIndex: 1, emit: async () => {} })
    expect(inputs).toHaveLength(4)
    expect(inputs[0]).toContain("PRIVATE-MOTIVE")
    for (const prompt of inputs.slice(1)) {
      expect(prompt).toContain("Please review the proposal.")
      expect(prompt).not.toContain("PRIVATE-MOTIVE")
      expect(prompt).not.toContain("PRIVATE-EXPECTATION")
    }
  } finally { model.mockRestore() }
})
