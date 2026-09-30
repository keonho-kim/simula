/**
 * Purpose: Verify richer final prose fits compact prompts and remains assembled from bounded independent calls.
 * Pattern: Synthesis contract tests with deterministic responses.
 * Usage: bun test src/backend/core/simulation/outputs/analysis/conclusion-context.test.ts
 * Related: src/backend/core/simulation/outputs/analysis/conclusion.ts, src/backend/core/simulation/outputs/analysis/conclusion-context.ts
 */
import { expect, test } from "bun:test"
import { createGenerationTasks } from "@/backend/core/generation/tasks"
import { ANALYSIS_SECTIONS } from "@/shared/analytical-report"
import { generateConclusion } from "./conclusion"
import { analysisFixture } from "./test-fixtures"
import { testPromptInput } from "@/backend/integrations/llm/testing/prompt-input"

test("long conclusion paragraphs remain accepted without a giant output call or unbounded context", async () => {
  const f = analysisFixture()
  const prose = "The participants deferred the proposal while checking its conditions. ".repeat(36).trim()
  f.dependencies.invoke = async call => {
    f.calls.push(call)
    return { text: call.id.endsWith("-summary") ? "The decision remains conditional. ".repeat(60).trim() : prose, truncated: false }
  }
  const evidence = { summary: "Evidence remains limited.", findings: [], evidenceIds: [] }
  const worldIds = Array.from({ length: 50 }, (_, index) => `world-${index}`)
  const conclusion = await generateConclusion(createGenerationTasks({ language: "en", fastMode: true }, f.dependencies), {
    perspective: { focus: "Focus ".repeat(350), objective: "Goal ".repeat(350), horizon: "Now ".repeat(350), boundary: "Scope ".repeat(350), evidenceIds: [] },
    source: evidence, observed: evidence,
    sections: ANALYSIS_SECTIONS.filter(id => id !== "conclusion").map(id => ({ id, status: "ready", summary: "Finding ".repeat(200),
      content: "Detailed supporting context. ".repeat(400), evidenceIds: [],
      findings: Array.from({ length: 3 }, () => ({ text: "A grounded interpretation. ".repeat(80), evidenceIds: [], provenance: ["simulation_observation"] })),
    })),
    trajectories: { categories: Array.from({ length: 6 }, (_, index) => ({ id: `path-${index}`, label: "A".repeat(100), description: "B".repeat(300), worldIds: worldIds.filter((_, i) => i % 6 === index) })), unclassifiedWorldIds: [] },
    coverage: { requested: 50, completed: 50, analyzed: 50, failed: 0, canceled: 0, interrupted: 0 },
    unavailableInputs: Array.from({ length: 1000 }, () => "missing".repeat(34)),
  })
  expect(prose.length).toBeGreaterThan(1800)
  expect(conclusion.content.length).toBeGreaterThan(5400)
  expect(conclusion.content).toContain("## Integrated judgment and next checks")
  expect(f.calls).toHaveLength(6)
  expect(f.calls.every(call => call.maxOutputTokens === 2048)).toBe(true)
  expect(Math.max(...f.calls.map(call => call.prompt.length))).toBeLessThan(15000)
  const final = f.calls.find(call => call.id === "conclusion-implications-content")!
  const packet = testPromptInput(final.prompt)
  expect(JSON.stringify(packet)).toContain("Detailed supporting context.")
  expect(JSON.stringify(packet)).toContain('"unavailableInputCount":1000')
  expect(JSON.stringify(packet)).not.toContain('"worldIds"')
  expect(final.prompt).toContain("2–3 substantive connected paragraphs")
})
