import { afterEach, describe, expect, test } from "bun:test"
import { providerModelsCacheKey, readProviderModelsCache, writeProviderModelsCache } from "./model-cache"

afterEach(() => {
  Reflect.deleteProperty(globalThis, "sessionStorage")
})

describe("provider model cache", () => {
  test("builds stable cache keys without storing raw API keys", () => {
    const left = providerModelsCacheKey("openai", {
      apiKey: "sk-secret",
      extraHeaders: { "X-B": "2", "X-A": "1" },
    })
    const right = providerModelsCacheKey("openai", {
      apiKey: "another-secret",
      extraHeaders: { "X-A": "1", "X-B": "2" },
    })

    expect(left).toBe(right)
    expect(left).not.toContain("sk-secret")
    expect(left).not.toContain("another-secret")
  })

  test("reads and writes model lists in session storage", () => {
    installSessionStorage()
    const cacheKey = providerModelsCacheKey("gemini", { apiKey: "google-key" })

    writeProviderModelsCache(cacheKey, ["gemini-2.5-pro", "gemini-2.0-flash"])

    expect(readProviderModelsCache(cacheKey)).toEqual(["gemini-2.5-pro", "gemini-2.0-flash"])
  })
})

function installSessionStorage(): void {
  const data = new Map<string, string>()
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    },
  })
}
