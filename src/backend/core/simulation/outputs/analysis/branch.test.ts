/**
 * Purpose: Verify analytical branch acceptance, scoring, and reference ownership without external models.
 * Pattern: Branch contract tests with controlled model responses.
 * Usage: bun test src/backend/core/simulation/outputs/analysis/branch.test.ts
 * Related: src/backend/core/simulation/outputs/analysis/branch.ts, src/shared/analytical-report-schema.ts
 */
import { expect, test } from "bun:test"
import { generateAnalyticalReport } from "./graph"
import { analysisFixture } from "./test-fixtures"

test("an out-of-range finding source retries locally and later reuses accepted siblings", async () => {
  const f = analysisFixture()
  const invoke = f.dependencies.invoke
  let fail = true
  f.dependencies.invoke = async call => {
    if (fail && call.id === "threats-finding-1-source") {
      f.calls.push(call)
      return { text: "999", truncated: false }
    }
    return invoke(call)
  }
  const first = await generateAnalyticalReport("report-one", f.input, f.dependencies)
  expect(first.sections.find(section => section.id === "threats")?.status).toBe("failed")
  expect(first.sections.find(section => section.id === "strengths")?.status).toBe("ready")
  expect(f.calls.filter(call => call.id === "threats-finding-1-source")).toHaveLength(3)
  fail = false; f.calls.length = 0
  const second = await generateAnalyticalReport("report-one", f.input, f.dependencies)
  expect(second.sections.every(section => section.status === "ready")).toBe(true)
  expect(f.calls.some(call => call.id.startsWith("strengths-finding"))).toBe(false)
  expect(f.calls.some(call => call.id === "threats-findings-summary")).toBe(false)
  expect(f.calls.some(call => call.id === "threats-finding-1-source")).toBe(true)
  expect(f.calls.some(call => call.id === "conclusion-implications-summary")).toBe(true)
})

test("SWOT without supported findings is unknown without another model request", async () => {
  const f = analysisFixture()
  const invoke = f.dependencies.invoke
  f.dependencies.invoke = async call => {
    if (call.id === "strengths-finding-count") {
      f.calls.push(call)
      return { text: "0", truncated: false }
    }
    return invoke(call)
  }
  const report = await generateAnalyticalReport("report-one", f.input, f.dependencies)
  expect(report.sections.find(section => section.id === "strengths")?.score?.value).toBeNull()
  expect(f.calls.filter(call => call.id === "strengths-score")).toHaveLength(0)
})

test("a zero gap marker means no additional uncertainty", async () => {
  const f = analysisFixture()
  const invoke = f.dependencies.invoke
  f.dependencies.invoke = async call => {
    if (call.id === "opportunities-finding-gap") {
      f.calls.push(call)
      return { text: "0", truncated: false }
    }
    return invoke(call)
  }
  const report = await generateAnalyticalReport("report-one", f.input, f.dependencies)
  expect(report.sections.find(section => section.id === "opportunities")?.status).toBe("ready")
  expect(f.calls.filter(call => call.id === "opportunities-finding-gap")).toHaveLength(1)
})

test("accepted findings derive provenance from stored references rather than model labels", async () => {
  const f = analysisFixture()
  const report = await generateAnalyticalReport("report-one", f.input, f.dependencies)
  const finding = report.sections.find(section => section.id === "materials")?.findings[0]
  if (!finding) throw new Error("The material assessment has no accepted finding.")
  const categories = finding.evidenceIds.map(id => {
    const reference = f.references.get(id)
    if (!reference) throw new Error(`Missing report reference ${id}.`)
    return reference.category
  })
  expect(categories.length).toBeGreaterThan(0)
  expect(finding.provenance).toEqual([...new Set(categories)])
})

test("material findings use plain fields and select program-owned source references", async () => {
  const f = analysisFixture()
  const report = await generateAnalyticalReport("report-field-findings", f.input, f.dependencies)
  const calls = f.calls.filter(call => call.kind === "assessment" && call.id.startsWith("materials-"))
  expect(calls.map(call => call.id)).toContain("materials-findings-summary")
  expect(calls.map(call => call.id)).toContain("materials-finding-1-source")
  expect(calls.map(call => call.id)).toContain("materials-finding-1-text")
  expect(calls.every(call => !call.prompt.includes("Required JSON shape"))).toBe(true)
  const finding = report.sections.find(section => section.id === "materials")?.findings[0]
  expect(finding?.evidenceIds.every(id => f.references.has(id))).toBe(true)
})

test("a complete longer branch overview reaches the report without repeated regeneration", async () => {
  const f = analysisFixture()
  const invoke = f.dependencies.invoke
  const overview = "The review still depends on a concrete assessment of available cost evidence. ".repeat(18).trim()
  f.dependencies.invoke = async call => {
    if (call.id === "weaknesses-findings-summary") {
      f.calls.push(call)
      return { text: overview, truncated: false }
    }
    return invoke(call)
  }
  const report = await generateAnalyticalReport("report-long-overview", f.input, f.dependencies)
  expect(report.sections.find(section => section.id === "weaknesses")).toMatchObject({ status: "ready", summary: overview })
  expect(f.calls.filter(call => call.id === "weaknesses-findings-summary")).toHaveLength(1)
})
