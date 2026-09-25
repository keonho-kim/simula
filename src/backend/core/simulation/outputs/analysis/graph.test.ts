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

test("material detail can finish before an unrelated world summary; report counts worlds and retains common rubric", async () => {
  const f = analysisFixture()
  const hold = Promise.withResolvers<void>()
  const materialReady = Promise.withResolvers<void>()
  const read = f.dependencies.readWorld
  const invoke = f.dependencies.invoke
  f.dependencies.readWorld = async id => { if (id === "run-second") await hold.promise; return read(id) }
  f.dependencies.invoke = async call => { if (call.id === "materials-detail") materialReady.resolve(); return invoke(call) }
  const work = generateAnalyticalReport("report-one", f.input, f.dependencies)
  try {
    await materialReady.promise
    expect(f.calls.some(call => call.id === "strengths-detail")).toBe(false)
    hold.resolve()
    const report = analyticalReportSchema.parse(await work)
    expect(report.sections.every(section => section.status === "ready")).toBe(true)
    expect(report.coverage).toEqual({ requested: 5, completed: 2, failed: 1, canceled: 1, interrupted: 1, analyzed: 2 })
    expect(report.trajectories.categories[0]?.worldIds).toEqual(["first", "second"])
    for (const call of f.calls.filter(call => call.id.startsWith("trajectory-world-"))) {
      expect(call.prompt).toContain("Allowed answer: one category index")
      expect(call.prompt).not.toContain('"rationale"')
    }
    expect(report.sections.filter(section => section.score).map(section => section.score?.value)).toEqual([2, 2, 2, 2])
    expect(report.evidenceIds.every(id => f.references.has(id))).toBe(true)
    expect(f.calls.every(call => call.maxOutputTokens === 2_048)).toBe(true)
    for (const id of ["strengths-score", "strengths-detail"]) {
      const packet = testPromptInput(f.calls.find(call => call.id === id)?.prompt ?? "")
      expect(packet.perspective).not.toHaveProperty("evidenceIds")
    }
    const strengthsPacket = testPromptInput(f.calls.find(call => call.id === "strengths-findings-summary")?.prompt ?? "")
    expect(strengthsPacket.observations).toHaveProperty("summary")
    expect(strengthsPacket.observations).not.toHaveProperty("findings")
    const detailPrompt = f.calls.find(call => call.id === "scenario-detail")?.prompt ?? ""
    expect(detailPrompt).toContain("Return one complete section in connected paragraphs")
    expect(detailPrompt).not.toContain("Required JSON shape")
    const worldMergePrompt = f.calls.find(call => call.id === "worlds-summary-0-0")?.prompt ?? ""
    expect(worldMergePrompt).toContain("2 accepted child summaries")
    const worldMerge = testPromptInput(worldMergePrompt)
    expect(JSON.stringify(worldMerge)).toContain("World first:")
    expect(JSON.stringify(worldMerge)).toContain("World second:")
    const conclusionPacket = testPromptInput(f.calls.find(call => call.id === "conclusion-implications-content")?.prompt ?? "")
    const sections = conclusionPacket.sections as Array<{ id: string; findings: Array<{ provenance: string[] }> }>
    expect(sections.find(section => section.id === "materials")?.findings[0]?.provenance).toContain("source_claim")
  } finally { hold.resolve(); await work }
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
