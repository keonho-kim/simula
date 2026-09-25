/**
 * Purpose: Verify completed commentary prose survives realistic long model responses.
 * Pattern: Node contract test.
 * Usage: bun test src/backend/core/simulation/outputs/commentary/node.test.ts
 * Related: src/backend/core/simulation/outputs/commentary/node.ts
 */
import { expect, spyOn, test } from "bun:test"
import { defaultSettings } from "@/backend/core/settings/defaults"
import * as invocation from "@/backend/integrations/llm/invoke"
import { buildCommentaryNode } from "./node"

test("a complete long conclusion is accepted after its shorter sibling fields", async () => {
  const conclusion = "The review remains conditional on the supplied evidence. ".repeat(40)
  const text = spyOn(invocation, "invokeRoleTextWithMetrics").mockImplementation(async (_settings, _role, _step, attempt, prompt) => ({
    text: String(prompt).includes("Field: summary") ? "The actors reviewed the decision."
      : String(prompt).includes("Field: finding-") ? "The decision remains conditional." : conclusion,
    metrics: { role: "observer", step: "reportCommentary", attempt, ttftMs: 0, durationMs: 0,
      inputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0, tokenSource: "unavailable" },
    diagnostics: { reasoningContentObserved: false, reasoningContent: "", finishReason: "stop" },
  }))
  const choice = spyOn(invocation, "invokeExactChoiceWithMetrics").mockImplementation(async (_settings, _role, _step, attempt) => ({
    text: "1", metrics: { role: "observer", step: "reportCommentary", attempt, ttftMs: 0, durationMs: 0,
      inputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0, tokenSource: "unavailable" },
    diagnostics: { reasoningContentObserved: false, reasoningContent: "", finishReason: "stop" },
  }))
  try {
    const node = await buildCommentaryNode({ task: { id: "round-1", level: 0, children: [], evidenceIds: ["round-1"], text: "A decision was deferred." },
      context: "The team reviews a decision.", language: "en", overall: false, settings: defaultSettings(), runId: "run",
      emit: async () => {}, isCanceled: () => false })
    expect(node.status).toBe("ready")
    expect(node.conclusion).toBe(conclusion.trim())
    expect(text).toHaveBeenCalledTimes(3)
  } finally { text.mockRestore(); choice.mockRestore() }
})
