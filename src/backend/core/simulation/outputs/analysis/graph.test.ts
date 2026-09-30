/**
 * Purpose: Verify analytical dependency ordering, bounded generation, conclusion scope, and world-based counting.
 * Pattern: Workflow contract tests with controlled model responses.
 * Usage: bun test src/backend/core/simulation/outputs/analysis/graph.test.ts
 * Related: src/backend/core/simulation/outputs/analysis/graph.ts, src/shared/analytical-report-schema.ts
 */
import { testPromptInput } from "@/backend/integrations/llm/testing/prompt-input"
import { expect, test } from "bun:test"
import { analyticalReportSchema } from "@/shared/analytical-report-schema"
import { generateAnalyticalReport } from "./graph"
import { aggregateTrajectories } from "./trajectories"
import { analysisFixture } from "./test-fixtures"

test("independent outcome branches retain grounded evidence without SWOT scoring", async () => {
  const f = analysisFixture()
  const report = analyticalReportSchema.parse(await generateAnalyticalReport("report-one", f.input, f.dependencies))
  expect(report.sections.every(section => section.status === "ready")).toBe(true)
  expect(report.coverage).toEqual({ requested: 5, completed: 2, failed: 1, canceled: 1, interrupted: 1, analyzed: 2 })
  expect(report.trajectories.categories[0]?.worldIds).toEqual(["first", "second"])
  expect(report.sections.every(section => !section.score)).toBe(true)
  expect(f.calls.some(call => call.id.endsWith("-score") || call.kind === "swot")).toBe(false)
  expect(report.evidenceIds.every(id => f.references.has(id))).toBe(true)
  expect(f.calls.every(call => call.maxOutputTokens === 2_048)).toBe(true)
  const packet = testPromptInput(f.calls.find(call => call.id === "outcomes-findings-summary")?.prompt ?? "")
  expect(packet.observations).toHaveProperty("summary")
  const detail = f.calls.find(call => call.id === "conditions-detail")?.prompt ?? ""
  expect(detail).toContain("Return one complete section in connected paragraphs")
  expect(detail).not.toContain("Required JSON shape")
  const worldMerge = testPromptInput(f.calls.find(call => call.id === "worlds-summary-0-0")?.prompt ?? "")
  expect(JSON.stringify(worldMerge)).toContain("World first:")
  expect(JSON.stringify(worldMerge)).toContain("World second:")
})

test("headline trajectories reject repeated world assignments and retain unclassified worlds", () => {
  const categories = [{ id: "path", label: "Review then defer", description: "Waits for evidence", worldIds: [] },
    { id: "unused", label: "Immediate approval", description: "Approves at once", worldIds: [] }]
  const result = aggregateTrajectories(categories, [{ worldId: "one", categoryId: "path" }, { worldId: "two", categoryId: null }])
  expect(result.categories.map(category => [category.id, category.worldIds])).toEqual([["path", ["one"]]])
  expect(result.unclassifiedWorldIds).toEqual(["two"])
  expect(aggregateTrajectories(categories, [{ worldId: "one", categoryId: null }]).categories).toEqual([])
  expect(() => aggregateTrajectories(categories, [{ worldId: "one", categoryId: "path" }, { worldId: "one", categoryId: "path" }])).toThrow("only one")
})

test("trajectory vocabulary uses finite counts and short text before code assigns categories", async () => {
  const f = analysisFixture()
  const report = await generateAnalyticalReport("report-trajectory-fields", f.input, f.dependencies)
  const calls = f.calls.filter(call => call.id.startsWith("trajectory-proposal-0"))
  expect(calls.map(call => call.id)).toEqual([
    "trajectory-proposal-0-count", "trajectory-proposal-0-label-1", "trajectory-proposal-0-description-1",
  ])
  expect(calls.every(call => !call.prompt.includes("Required JSON shape"))).toBe(true)
  expect(report.trajectories.categories[0]?.id).toBe("trajectory-1")
})

test("common report perspective accepts four short fields and code assigns references", async () => {
  const f = analysisFixture()
  const report = await generateAnalyticalReport("report-perspective", f.input, f.dependencies)
  const fields = f.calls.filter(call => call.kind === "perspective")
  expect(fields.map(call => call.id)).toEqual(["perspective-focus", "perspective-objective", "perspective-horizon", "perspective-boundary"])
  expect(fields.every(call => !call.prompt.includes("Required JSON shape"))).toBe(true)
  expect(report.perspective.focus).toBe("Investment committee")
  expect(report.perspective.evidenceIds).toEqual(fields[0]?.evidenceIds)
})

test("complete trajectory proposals with repeated labels and long descriptions remain usable", async () => {
  const f = analysisFixture()
  const invoke = f.dependencies.invoke
  f.dependencies.invoke = call => {
    const text = call.id === "trajectory-proposal-0-count" ? "2"
      : call.id === "trajectory-proposal-0-label-1" ? "Review then defer"
        : call.id === "trajectory-proposal-0-label-2" ? "REVIEW THEN DEFER"
          : call.id === "trajectory-proposal-0-description-1" ? "Evidence remains pending. ".repeat(20) : undefined
    if (text === undefined) return invoke(call)
    f.calls.push(call)
    return Promise.resolve({ text, truncated: false })
  }
  const report = await generateAnalyticalReport("report-proposal", f.input, f.dependencies)
  expect(report.sections.find(section => section.id === "trajectories")?.status).toBe("ready")
  expect(report.trajectories.categories).toHaveLength(1)
  expect(report.trajectories.categories[0]?.description.length).toBeLessThanOrEqual(300)
})

test("conclusion can cite a code-owned perspective reference omitted by section summaries", async () => {
  const f = analysisFixture()
  f.input.scenarioText = "A reviewed launch needs a decision. ".repeat(150)
  const report = await generateAnalyticalReport("report-one", f.input, f.dependencies)
  const perspectiveId = f.calls.find(call => call.id === "perspective-focus")?.evidenceIds.at(-1)
  if (!perspectiveId) throw new Error("Perspective source reference was not supplied.")
  expect(report.perspective.evidenceIds).toContain(perspectiveId)
  expect(f.calls.find(call => call.id === "conclusion-implications-content")?.evidenceIds).toContain(perspectiveId)
})
