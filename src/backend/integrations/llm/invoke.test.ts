/**
 * Purpose: Verify fail-fast exact-choice and reasoning diagnostic contracts.
 * Pattern: Contract test.
 * Usage: Executed by bun test.
 * Related: src/backend/integrations/llm/invoke.ts
 */
import { exactChoiceMessages } from "@/backend/integrations/llm/prompts/exact-choice"
import { describe, expect, test } from "bun:test"
import type { RoleTextResult } from "./invoke"
import { applyInvocationBudget, exactChoiceOutputs, reasoningOnlyWarning } from "./invoke"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { resolveRoleSettings } from "@/backend/core/settings/resolve"

describe("LLM invocation contracts", () => {
  test("caps each call without mutating role settings or increasing a configured ceiling", () => {
    const config = resolveRoleSettings(defaultSettings(), "planner")
    const first = applyInvocationBudget(config, { maxOutputTokens: 512 })
    const second = applyInvocationBudget(config, { maxOutputTokens: 256 })
    expect(first.maxTokens).toBe(512)
    expect(second.maxTokens).toBe(256)
    expect(config.maxTokens).toBe(4096)
    expect(applyInvocationBudget(config, { maxOutputTokens: 8000 }).maxTokens).toBe(4096)
    expect(() => applyInvocationBudget(config, { maxOutputTokens: -1 })).toThrow("positive integer")
  })

  test("exact choices reject impossible or ambiguous output sets before provider I/O", () => {
    expect(() => exactChoiceOutputs([])).toThrow("at least one")
    expect(() => exactChoiceOutputs(["continue", " continue "])).toThrow("distinct")
    expect(() => exactChoiceOutputs(["continue", " "])).toThrow("non-empty")
  })

  test("exact choice messages preserve a compact structured classifier request", () => {
    const messages = exactChoiceMessages("Compare the rounds.", ["1", "0"])
    if (!Array.isArray(messages)) throw new Error("Expected structured messages")
    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({ role: "system" })
    expect(messages[1]?.content).toContain("- 1\n- 0")
  })

  test("reasoning-only length completion produces an actionable warning", () => {
    const result = {
      text: "",
      metrics: {
        role: "coordinator",
        step: "progressDecision",
        attempt: 1,
        ttftMs: 10,
        durationMs: 20,
        inputTokens: 10,
        reasoningTokens: 5,
        outputTokens: 0,
        totalTokens: 15,
        tokenSource: "provider",
      },
      diagnostics: {
        reasoningContentObserved: true,
        reasoningContent: "internal",
        finishReason: "length",
      },
    } satisfies RoleTextResult
    expect(reasoningOnlyWarning(result)).toContain("completion budget was exhausted")
  })
})
