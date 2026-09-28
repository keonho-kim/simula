/**
 * Purpose: Verify settings discovery waits for the required connection and explicit model choice.
 * Pattern: Pure form-policy tests.
 * Usage: Executed by bun test.
 * Related: src/ui/models/settings/settings-options.ts, src/ui/models/settings/draft-updates.ts
 */
import { describe, expect, test } from "bun:test"
import { extraBodyExamples, hasProviderConnection } from "@/ui/models/settings/settings-options"
import { selectRoleProvider } from "@/ui/models/settings/draft-updates"

describe("settings dialog constants", () => {
  test("does not default LM Studio to reasoning mode", () => {
    expect(extraBodyExamples.lmstudio).toBeUndefined()
  })
  test("unconfigured cloud providers do not trigger discovery", () => {
    expect(hasProviderConnection("openai", {})).toBe(false)
    expect(hasProviderConnection("openai", { apiKey: "  " })).toBe(false)
    expect(hasProviderConnection("openai", { apiKey: "test-key" })).toBe(true)
    expect(hasProviderConnection("lmstudio", { baseUrl: "http://localhost:1234/v1" })).toBe(true)
    expect(hasProviderConnection("lmstudio", {})).toBe(false)
  })
  test("changing a provider requires a model selection instead of inventing a default model", () => {
    const role = selectRoleProvider({ provider: "openai", model: "saved-model", temperature: 0.2, maxTokens: 1000, timeoutSeconds: 60 }, "lmstudio")
    expect(role.provider).toBe("lmstudio")
    expect(role.model).toBe("")
    expect(role.reasoningEffort).toBeUndefined()
    expect(role.maxTokens).toBe(1000)
  })
})
