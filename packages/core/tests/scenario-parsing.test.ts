/**
 * Purpose: Verify scenario frontmatter parsing, defaults, samples, and input rejection.
 * Pattern: Boundary contract test.
 * Usage: Executed by bun test.
 * Related: src/backend/core/scenario/index.ts, src/backend/storage/samples.ts
 */
import { describe, expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { parseScenarioDocument } from "@/backend/core/scenario"
import { listScenarioSamples } from "@/backend/storage/samples"

describe("scenario parsing", () => {
test("parses frontmatter controls and body", () => {
    const scenario = parseScenarioDocument(`---\nnum_cast: 3\nallow_additional_cast: false\n---\nA crisis unfolds.`)

    expect(scenario.controls).toEqual({ numCast: 3, allowAdditionalCast: false, actionsPerType: 3, maxRound: 8, fastMode: false, autonomousProgress: false, outputLength: "short", loadLevel: "middle" })
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

  test("rejects actor context token budget frontmatter", () => {
    expect(() =>
      parseScenarioDocument(`---\nnum_cast: 2\nactor_context_token_budget: 1200\n---\nA crisis unfolds.`)
    ).toThrow("Unsupported scenario control: actor_context_token_budget")
  })

  test("parses output length from frontmatter", () => {
    const scenario = parseScenarioDocument(
      `---\nnum_cast: 2\noutput_length: medium\n---\nA crisis unfolds.`
    )

    expect(scenario.controls.outputLength).toBe("medium")
  })

  test("parses load level from frontmatter", () => {
    for (const loadLevel of ["low", "middle", "high"] as const) {
      const scenario = parseScenarioDocument(
        `---\nnum_cast: 2\nload_level: ${loadLevel}\n---\nA crisis unfolds.`
      )

      expect(scenario.controls.loadLevel).toBe(loadLevel)
    }
  })

  test("defaults missing load level to middle", () => {
    const scenario = parseScenarioDocument(`---\nnum_cast: 2\n---\nA crisis unfolds.`)

    expect(scenario.controls.loadLevel).toBe("middle")
  })

  test("rejects unsupported load level", () => {
    expect(() => parseScenarioDocument(`---\nnum_cast: 2\nload_level: medium\n---\nA crisis unfolds.`)).toThrow(
      "load_level must be low, middle, or high"
    )
  })

  test("rejects unsupported output length", () => {
    expect(() => parseScenarioDocument(`---\nnum_cast: 2\noutput_length: huge\n---\nA crisis unfolds.`)).toThrow(
      "output_length must be short, medium, or long"
    )
  })

  test("parses max round from frontmatter", () => {
    const scenario = parseScenarioDocument(`---\nnum_cast: 2\nmax_round: 4\n---\nA crisis unfolds.`)

    expect(scenario.controls.maxRound).toBe(4)
  })

  test("loads all scenario samples with load levels", async () => {
    const samples = await listScenarioSamples(fileURLToPath(new URL("../../../senario.samples", import.meta.url)))
    const sampleNames = new Set(samples.map((sample) => sample.name))

    expect(samples.every((sample) => ["low", "middle", "high"].includes(sample.controls.loadLevel ?? ""))).toBe(true)
    expect(sampleNames).toEqual(new Set([
      "01_consumer_marketing_launch.md",
      "02_wargame_iran_us.md",
      "03_startup_boardroom_crisis.md",
      "04_city_hall_disaster_response.md",
      "05_korean_enterprise_promo_approval_conflict.md",
      "06_new_technology_internal_conflict.md",
      "07_relationship_triangle_conflict.md",
      "08_family_clinic_care_decision.md",
      "09_apartment_redevelopment_committee.md",
      "10_regional_bank_social_media_run.md",
      "11_airport_weather_disruption_command.md",
      "12_hospital_network_ransomware_coordination.md",
    ]))
  })
})
