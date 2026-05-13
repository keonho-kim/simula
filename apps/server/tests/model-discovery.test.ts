import { afterEach, describe, expect, test } from "bun:test"
import { listProviderModels } from "../src/model-discovery"

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

describe("model discovery", () => {
  test("filters and sorts OpenAI GPT model families by version", async () => {
    globalThis.fetch = (async () => Response.json({
      data: [
        { id: "gpt-5.2-mini" },
        { id: "gpt-5-nano" },
        { id: "gpt-5.4-mini" },
        { id: "gpt-5-codex" },
        { id: "gpt-4o-2024-08-06" },
        { id: "gpt-4.1" },
        { id: "text-embedding-3-large" },
      ],
    })) as unknown as typeof fetch

    await expect(listProviderModels({
      provider: "openai",
      connection: { apiKey: "test-key" },
    })).resolves.toEqual({
      models: ["gpt-5.4-mini", "gpt-5.2-mini", "gpt-5-nano", "gpt-4.1"],
    })
  })

  test("normalizes Gemini model names from the models API", async () => {
    globalThis.fetch = (async () => Response.json({
      models: [
        { name: "models/gemini-2.0-flash", supportedGenerationMethods: ["generateContent"] },
        { name: "models/text-embedding-004", supportedGenerationMethods: ["embedContent"] },
        { baseModelId: "gemini-2.5-pro", name: "models/gemini-2.5-pro" },
      ],
    })) as unknown as typeof fetch

    await expect(listProviderModels({
      provider: "gemini",
      connection: { apiKey: "test-key" },
    })).resolves.toEqual({
      models: ["gemini-2.5-pro", "gemini-2.0-flash"],
    })
  })

  test("sorts dated Anthropic models by newest date", async () => {
    globalThis.fetch = (async () => Response.json({
      data: [
        { id: "claude-sonnet-4-20250514" },
        { id: "claude-3-7-sonnet-20250219" },
        { id: "claude-opus-4-1-20250805" },
      ],
    })) as unknown as typeof fetch

    await expect(listProviderModels({
      provider: "anthropic",
      connection: { apiKey: "test-key" },
    })).resolves.toEqual({
      models: ["claude-opus-4-1-20250805", "claude-sonnet-4-20250514", "claude-3-7-sonnet-20250219"],
    })
  })
})
