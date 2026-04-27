import { describe, expect, test } from "bun:test"
import { parseScenarioDocument, validateSettings, defaultSettings, normalizeSettings } from "../src"

describe("scenario parsing", () => {
  test("parses frontmatter controls and body", () => {
    const scenario = parseScenarioDocument(`---\nnum_cast: 3\nallow_additional_cast: false\n---\nA crisis unfolds.`)

    expect(scenario.controls).toEqual({ numCast: 3, allowAdditionalCast: false, actionsPerType: 3, fastMode: false })
    expect(scenario.text).toBe("A crisis unfolds.")
  })

  test("rejects unsupported controls", () => {
    expect(() => parseScenarioDocument(`---\nnum_cast: 3\nfoo: bar\n---\nBody`)).toThrow(
      "Unsupported scenario control"
    )
  })

  test("parses actions per type from frontmatter", () => {
    const scenario = parseScenarioDocument(
      `---\nnum_cast: 2\nallow_additional_cast: true\nactions_per_type: 4\n---\nA crisis unfolds.`
    )

    expect(scenario.controls.actionsPerType).toBe(4)
  })

  test("parses fast mode from frontmatter", () => {
    const scenario = parseScenarioDocument(
      `---\nnum_cast: 2\nallow_additional_cast: true\nactions_per_type: 4\nfast_mode: true\n---\nA crisis unfolds.`
    )

    expect(scenario.controls.fastMode).toBe(true)
  })
})

describe("settings validation", () => {
  test("fails explicitly when provider key is missing", () => {
    expect(() => validateSettings(defaultSettings())).toThrow("API key is required")
  })

  test("includes StoryBuilder settings", () => {
    expect(defaultSettings().storyBuilder.model).toBeTruthy()
  })

  test("migrates actor settings to generator settings", () => {
    const settings = normalizeSettings({
      actor: {
        provider: "anthropic",
        model: "legacy-actor",
        apiKey: "legacy-key",
        temperature: 0.3,
        maxTokens: 1234,
        timeoutSeconds: 45,
      },
    } as Parameters<typeof normalizeSettings>[0] & { actor: ReturnType<typeof defaultSettings>["generator"] })

    expect(settings.generator.model).toBe("legacy-actor")
    expect(settings.generator.apiKey).toBe("legacy-key")
  })
})
