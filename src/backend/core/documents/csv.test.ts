/**
 * Purpose: Verify CSV headers, row provenance, bounded sampling, and parse failures.
 * Pattern: Pure transformation contract test.
 * Usage: bun test src/backend/core/documents/csv.test.ts
 * Related: src/backend/core/documents/csv.ts, src/shared/documents.ts
 */
import { expect, test } from "bun:test"
import { extractCsvEvidence } from "./csv"

const bytes = (text: string) => new TextEncoder().encode(text)

test("quoted Korean cells retain column names and record locations", () => {
  const evidence = extractCsvEvidence("source", bytes('"Risk, type",Owner,Impact\n"인증 지연\n추가 검토",CTO,"5월, 12일"\n'))
  expect(evidence.coverage).toMatchObject({ totalUnits: 2, processedUnits: 2, failedUnits: 0 })
  const row = evidence.blocks.find(block => block.locator.kind === "table" && block.locator.startRow === 2)
  expect(row?.content).toContain("Risk, type: 인증 지연\n추가 검토")
  expect(row?.content).toContain("Impact: 5월, 12일")
  expect(row?.locator).toMatchObject({ kind: "table", element: "#/csv/records/2", startRow: 2, endRow: 2 })
})

test("empty cells remain explicit and column statistics count them", () => {
  const evidence = extractCsvEvidence("source", bytes("Risk,Owner,Impact\nBudget,,40"))
  expect(evidence.blocks.some(block => block.content.includes("Owner: [empty]"))).toBe(true)
  expect(evidence.blocks.some(block => block.content.includes("Owner: Missing: 1"))).toBe(true)
})

test("large CSV summarizes all rows while retaining first and last row evidence", () => {
  const lines = ["Name,Amount", ...Array.from({ length: 180 }, (_, index) => `row-${index + 1},${index + 1}`)]
  const evidence = extractCsvEvidence("source", bytes(lines.join("\n")))
  expect(evidence.coverage).toMatchObject({ totalUnits: 181, processedUnits: 181, skippedUnits: 0 })
  expect(evidence.issues.some(issue => issue.code === "csv_rows_sampled")).toBe(true)
  expect(evidence.blocks.some(block => block.content.includes("row-1"))).toBe(true)
  expect(evidence.blocks.some(block => block.content.includes("row-180"))).toBe(true)
  expect(evidence.blocks.some(block => block.content.includes("Numeric values: 180") && block.content.includes("Maximum: 180"))).toBe(true)
  expect(evidence.blocks.some(block => block.content.includes("row-90"))).toBe(false)
})

test("malformed columns and ambiguous headers fail at the CSV boundary", () => {
  expect(() => extractCsvEvidence("source", bytes("Name,Amount\nA,1,unexpected"))).toThrow("columns")
  expect(() => extractCsvEvidence("source", bytes("Name,Name\nA,B"))).toThrow("header")
  expect(() => extractCsvEvidence("source", bytes('Name,Amount\n"unfinished,1'))).toThrow("CSV")
})
