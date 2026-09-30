/**
 * Purpose: Verify reports explain observed development without generating SWOT scores.
 * Pattern: Workflow contract test.
 * Usage: Executed by bun test.
 * Related: src/backend/core/simulation/outputs/analysis/graph.ts
 */
import { expect, test } from "bun:test"
import { generateAnalyticalReport } from "./graph"
import { analysisFixture } from "./test-fixtures"

test("single-world report focuses on outcomes, turning points, actors, conditions, and implications", async () => {
  const f = analysisFixture()
  f.input.subject = { kind: "run", id: "run-first" }
  f.input.worlds = [f.input.worlds[0]!]
  const report = await generateAnalyticalReport("focused-report", f.input, f.dependencies)
  expect(report.sections.map(section => section.id)).toEqual(["outcomes", "turning-points", "actors", "conditions", "implications", "conclusion"])
  expect(f.calls.some(call => call.kind === "swot" || call.id.endsWith("-score"))).toBe(false)
  expect(f.calls.some(call => call.id.startsWith("trajectory-"))).toBe(false)
})
