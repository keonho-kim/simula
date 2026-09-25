/**
 * Purpose: Verify conclusion synthesis keeps source and simulated evidence scoped across bounded failures.
 * Pattern: Workflow contract tests with controlled generation.
 * Usage: bun test src/backend/core/simulation/outputs/analysis/conclusion.test.ts
 * Related: src/backend/core/simulation/outputs/analysis/conclusion.ts, src/backend/core/simulation/outputs/analysis/test-fixtures.ts
 */
import { testPromptInput } from "@/backend/integrations/llm/testing/prompt-input"
import { expect, test } from "bun:test"
import { generateAnalyticalReport } from "./graph"
import { analysisFixture } from "./test-fixtures"

test("source and observation paragraphs can progress independently but implications wait for both", async () => {
  const f = analysisFixture()
  const held = Promise.withResolvers<void>()
  const sourceStarted = Promise.withResolvers<void>()
  const observationStarted = Promise.withResolvers<void>()
  const invoke = f.dependencies.invoke
  f.dependencies.invoke = async call => {
    if (call.id === "conclusion-source-summary") { sourceStarted.resolve(); await held.promise }
    if (call.id === "conclusion-observations-summary") observationStarted.resolve()
    return invoke(call)
  }
  const work = generateAnalyticalReport("report-one", f.input, f.dependencies)
  try {
    const reached = await Promise.race([sourceStarted.promise.then(() => true), work.then(() => false)])
    expect(reached).toBe(true)
    await observationStarted.promise
    expect(f.calls.some(call => call.id === "conclusion-implications-summary")).toBe(false)
    held.resolve()
    const report = await work
    expect(report.sections.find(section => section.id === "conclusion")?.status).toBe("ready")
    const source = f.calls.find(call => call.id === "conclusion-source-summary")
    const observed = f.calls.find(call => call.id === "conclusion-observations-summary")
    expect(source).toBeDefined()
    expect(observed).toBeDefined()
    const packet = testPromptInput(source?.prompt ?? "")
    expect(packet).not.toHaveProperty("simulatedWorlds")
    expect(packet).not.toHaveProperty("sections")
    expect(source?.evidenceIds.every(id => f.references.get(id)?.category === "source_claim")).toBe(true)
    expect(observed?.evidenceIds.every(id => !!f.references.get(id)?.runId)).toBe(true)
    expect(observed?.evidenceIds.some(id => f.references.get(id)?.category === "simulation_observation")).toBe(true)
    expect(f.calls.filter(call => call.kind === "conclusion").every(call => call.maxOutputTokens === 2_048)).toBe(true)
    expect(f.calls.some(call => call.id === "conclusion-detail")).toBe(false)
  } finally { held.resolve(); await work }
})

test("conclusion parts accept short summaries and prose separately without model-authored JSON", async () => {
  const f = analysisFixture()
  const report = await generateAnalyticalReport("report-fields", f.input, f.dependencies)
  expect(report.sections.find(section => section.id === "conclusion")?.status).toBe("ready")
  expect(f.calls.filter(call => call.kind === "conclusion").map(call => call.id).sort()).toEqual([
    "conclusion-source-summary", "conclusion-observations-summary",
    "conclusion-source-content", "conclusion-observations-content",
    "conclusion-implications-summary", "conclusion-implications-content",
  ].sort())
  expect(f.calls.filter(call => call.kind === "conclusion").every(call => !call.prompt.includes("Required JSON shape"))).toBe(true)
})

test("a complete longer implication sentence becomes the integrated report summary", async () => {
  const f = analysisFixture()
  const original = f.dependencies.invoke
  const integrated = "The document leaves costs unverified, while the simulation only shows a deferred decision; "
    + "confirm funding and cost exposure before treating either simulated path as a real-world recommendation."
  f.dependencies.invoke = async call => call.id === "conclusion-implications-summary"
    ? { text: integrated, truncated: false } : original(call)
  const report = await generateAnalyticalReport("report-integrated", f.input, f.dependencies)
  expect(report.sections.find(section => section.id === "conclusion")?.status).toBe("ready")
  expect(report.sections.find(section => section.id === "conclusion")?.summary).toBe(integrated)
})

test("malformed observation output does not discard an accepted source paragraph", async () => {
  const f = analysisFixture()
  const invoke = f.dependencies.invoke
  let fail = true
  f.dependencies.invoke = async call => {
    if (fail && call.id === "conclusion-observations-summary") {
      f.calls.push(call)
      return { text: "", truncated: false }
    }
    return invoke(call)
  }
  const first = await generateAnalyticalReport("report-one", f.input, f.dependencies)
  expect(first.sections.find(section => section.id === "conclusion")?.status).toBe("failed")
  expect(f.calls.some(call => call.id === "conclusion-implications-summary")).toBe(false)
  fail = false
  f.calls.length = 0
  const second = await generateAnalyticalReport("report-one", f.input, f.dependencies)
  expect(second.sections.find(section => section.id === "conclusion")?.status).toBe("ready")
  expect(f.calls.some(call => call.id.startsWith("conclusion-source-"))).toBe(false)
  expect(f.calls.some(call => call.id === "conclusion-observations-summary")).toBe(true)
})

test("a truncated observation paragraph repairs locally and preserves the source paragraph", async () => {
  const f = analysisFixture()
  const invoke = f.dependencies.invoke
  let drafts = 0
  f.dependencies.invoke = async call => {
    if (call.id === "conclusion-observations-content" && ++drafts === 1) {
      f.calls.push(call)
      return { text: "Participants requested more evidence.", truncated: true }
    }
    return invoke(call)
  }
  const report = await generateAnalyticalReport("report-one", f.input, f.dependencies)
  expect(report.sections.find(section => section.id === "conclusion")?.status).toBe("ready")
  expect(drafts).toBe(2)
  expect(f.calls.filter(call => call.id === "conclusion-source-summary")).toHaveLength(1)
  expect(f.calls.filter(call => call.id === "conclusion-source-content")).toHaveLength(1)
  expect(f.calls.filter(call => call.id === "conclusion-implications-summary")).toHaveLength(1)
})
