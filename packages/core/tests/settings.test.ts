/**
 * Purpose: Verify settings normalization, provider requirements, model diagnostics, and telemetry.
 * Pattern: Boundary contract test.
 * Usage: Executed by bun test.
 * Related: src/backend/core/settings/normalize.ts, src/backend/integrations/llm/invoke.ts
 */
import { exactChoiceMessages } from "@/backend/integrations/llm/prompts/exact-choice"
import { describe, expect, test } from "bun:test"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { normalizeSettings } from "@/backend/core/settings/normalize"
import { resolveRoleSettings } from "@/backend/core/settings/resolve"
import { validateSettings } from "@/backend/core/settings/validate"
import { renderPromptReasoningGuide, withRolePromptGuide } from "@/backend/core/prompts/language"
import { buildExactChoiceSettings, reasoningOnlyWarning } from "@/backend/integrations/llm"
import { readUsage } from "@/backend/integrations/llm/usage"
import { emitModelTelemetry } from "@/backend/core/simulation/events/telemetry"

describe("settings validation", () => {
test("fails explicitly when provider key is missing", () => {
    expect(() => validateSettings(defaultSettings())).toThrow("API key is required")
  })

  test("includes StoryBuilder settings", () => {
    expect(defaultSettings().roles.storyBuilder.model).toBeTruthy()
  })

  test("includes actor settings", () => {
    expect(defaultSettings().roles.actor.model).toBeTruthy()
  })

  test("drops removed actor context token budget settings", () => {
    const settings = normalizeSettings({
      roles: {
        actor: {
          provider: "openai",
          model: "actor-model",
          temperature: 0.4,
          maxTokens: 1000,
          timeoutSeconds: 60,
          contextTokenBudget: 2000,
        },
      },
    } as Parameters<typeof normalizeSettings>[0])

    expect("contextTokenBudget" in settings.roles.actor).toBe(false)
  })

  test("migrates coordinator settings to actor settings", () => {
    const settings = normalizeSettings({
      coordinator: {
        provider: "anthropic",
        model: "coordinator-model",
        apiKey: "coordinator-key",
        temperature: 0.3,
        maxTokens: 1234,
        timeoutSeconds: 45,
      },
    } as Parameters<typeof normalizeSettings>[0])

    expect(settings.roles.actor.model).toBe("coordinator-model")
    expect(settings.providers.anthropic.apiKey).toBe("coordinator-key")
  })

  test("promotes the first legacy provider connection", () => {
    const settings = normalizeSettings({
      storyBuilder: {
        provider: "lmstudio",
        model: "story-model",
        apiKey: "first-key",
        baseUrl: "http://first.test/v1",
        temperature: 0.3,
        maxTokens: 1000,
        timeoutSeconds: 30,
      },
      planner: {
        provider: "lmstudio",
        model: "planner-model",
        apiKey: "second-key",
        baseUrl: "http://second.test/v1",
        temperature: 0.3,
        maxTokens: 1000,
        timeoutSeconds: 30,
      },
    } as Parameters<typeof normalizeSettings>[0])

    expect(settings.providers.lmstudio.apiKey).toBe("first-key")
    expect(settings.providers.lmstudio.baseUrl).toBe("http://first.test/v1")
    expect(settings.roles.planner.model).toBe("planner-model")
  })

  test("supports Gemini settings", () => {
    const settings = defaultSettings()
    settings.providers.gemini.apiKey = "google-key"
    for (const role of Object.keys(settings.roles) as Array<keyof typeof settings.roles>) {
      settings.roles[role].provider = "gemini"
      settings.roles[role].model = "gemini-2.5-pro"
    }

    expect(() => validateSettings(settings)).not.toThrow()
  })

  test("allows OpenAI-compatible local providers without API keys", () => {
    const settings = defaultSettings()
    settings.providers.ollama.apiKey = ""
    settings.providers.ollama.baseUrl = "http://localhost:11434/v1"
    for (const role of Object.keys(settings.roles) as Array<keyof typeof settings.roles>) {
      settings.roles[role].provider = "ollama"
      settings.roles[role].model = "llama3.1"
    }

    expect(() => validateSettings(settings)).not.toThrow()
  })

  test("requires base URL for OpenAI-compatible providers", () => {
    const settings = defaultSettings()
    settings.providers.vllm.apiKey = ""
    settings.providers.vllm.baseUrl = ""
    for (const role of Object.keys(settings.roles) as Array<keyof typeof settings.roles>) {
      settings.roles[role].provider = "vllm"
      settings.roles[role].model = "local-model"
    }

    expect(() => validateSettings(settings)).toThrow("Base URL is required")
  })

  test("fills provider defaults while normalizing settings", () => {
    const settings = normalizeSettings({
      actor: {
        provider: "lmstudio",
        model: "local-model",
        temperature: 0.4,
        maxTokens: 4096,
        timeoutSeconds: 60,
      },
    } as Parameters<typeof normalizeSettings>[0])

    expect(settings.providers.lmstudio.baseUrl).toBe("http://localhost:1234/v1")
    expect(resolveRoleSettings(settings, "actor").reasoningEffort).toBeUndefined()
  })

  test("preserves explicitly configured reasoning effort", () => {
    const settings = normalizeSettings({
      actor: {
        provider: "lmstudio",
        model: "local-model",
        temperature: 0.4,
        maxTokens: 4096,
        timeoutSeconds: 60,
        reasoningEffort: "medium",
      },
    } as Parameters<typeof normalizeSettings>[0])

    expect(resolveRoleSettings(settings, "actor").reasoningEffort).toBe("medium")
  })

  test("builds exact-choice settings without reasoning controls", () => {
    const settings = normalizeSettings({
      actor: {
        provider: "lmstudio",
        model: "local-model",
        temperature: 0.4,
        maxTokens: 4096,
        timeoutSeconds: 60,
        reasoningEffort: "medium",
        extraBody: { reasoning_effort: "medium", seed: 7 },
      },
    } as Parameters<typeof normalizeSettings>[0])

    const exact = buildExactChoiceSettings(settings, "actor")

    expect(exact.temperature).toBe(0)
    expect(exact.maxTokens).toBe(2_048)
    expect(exact.reasoningEffort).toBeUndefined()
    expect(exact.extraBody).toEqual({ seed: 7, reasoning_effort: "none" })
    expect(resolveRoleSettings(settings, "actor").reasoningEffort).toBe("medium")
  })

  test("builds exact-choice chat messages", () => {
    const messages = exactChoiceMessages("Choose one.", ["actor-1-public-1", "no_action"])

    expect(messages).toEqual([
      expect.objectContaining({ role: "system" }),
      expect.objectContaining({ role: "user" }),
    ])
    expect(JSON.stringify(messages)).toContain("Do not reason")
    expect(JSON.stringify(messages)).toContain("- actor-1-public-1")
    expect(JSON.stringify(messages)).toContain("assistant content")
    expect(JSON.stringify(messages)).not.toContain("thinking phase")
  })

  test("renders reasoning guide from configured effort", () => {
    expect(renderPromptReasoningGuide(undefined)).toBe("")
    expect(renderPromptReasoningGuide("low")).toContain("within 5 short sentences")
    expect(renderPromptReasoningGuide("medium")).toContain("within 10 short sentences")
    expect(renderPromptReasoningGuide("high")).toContain("within 3 compact paragraphs")
  })

  test("adds reasoning guide only to role-aware prompts", () => {
    const settings = defaultSettings()
    settings.roles.observer.reasoningEffort = "medium"

    const prompt = withRolePromptGuide("Summarize the round.", {
      language: "en",
      settings,
      role: "observer",
    })

    expect(prompt).toContain("Language: English")
    expect(prompt).toContain("within 10 short sentences")
    expect(prompt).toContain("Summarize the round.")
    expect(withRolePromptGuide("Summarize the round.", { language: "en", settings, role: "actor" })).not.toContain(
      "thinking phase"
    )
  })

  test("diagnoses reasoning-only responses", () => {
    const warning = reasoningOnlyWarning({
      text: "",
      metrics: {
        role: "actor",
        step: "action",
        attempt: 1,
        ttftMs: 1,
        durationMs: 2,
        inputTokens: 1,
        reasoningTokens: 64,
        outputTokens: 64,
        totalTokens: 65,
        tokenSource: "provider",
      },
      diagnostics: { reasoningContentObserved: true, reasoningContent: "thinking", finishReason: "length" },
    })

    expect(warning).toContain("completion budget was exhausted")
  })

  test("reads reasoning token usage from provider metadata", () => {
    expect(readUsage({
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
      output_token_details: { reasoning: 7 },
    })?.reasoningTokens).toBe(7)
    expect(readUsage({
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
      completion_tokens_details: { reasoning_tokens: 8 },
    })?.reasoningTokens).toBe(8)
    expect(readUsage({
      input_tokens: 10,
      output_tokens: 20,
      total_tokens: 30,
      output_tokens_details: { reasoning_tokens: 9 },
    })?.reasoningTokens).toBe(9)
  })

  test("emits reasoning telemetry when provider reports reasoning tokens", async () => {
    const events: Array<{ type: string; content?: string }> = []
    await emitModelTelemetry("run-1", {
      text: "final",
      metrics: {
        role: "observer",
        step: "roundSummary",
        attempt: 1,
        ttftMs: 1,
        durationMs: 2,
        inputTokens: 10,
        reasoningTokens: 5,
        outputTokens: 20,
        totalTokens: 30,
        tokenSource: "provider",
      },
      diagnostics: { reasoningContentObserved: false, reasoningContent: "" },
    }, async (event) => {
      events.push({ type: event.type, content: event.type === "model.reasoning" ? event.content : undefined })
    })

    expect(events.map((event) => event.type)).toEqual(["model.metrics", "model.reasoning"])
    expect(events[1]?.content).toContain("not provided")
  })
})
