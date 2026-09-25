/**
 * Purpose: Verify bounded XLSX formula evidence retains sheet, cell, and cached result provenance.
 * Pattern: Archive adapter contract test.
 * Usage: bun test src/backend/integrations/documents/xlsx-source.test.ts
 * Related: src/backend/integrations/documents/xlsx-source.ts
 */
import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { strToU8, zipSync } from "fflate"
import { extractXlsxFormulaEvidence, extractXlsxSourceEvidence } from "./xlsx-source"

function workbookZip(formulas: string) {
  return zipSync({
    "xl/workbook.xml": strToU8('<workbook><sheets><sheet name="Budget 2027" sheetId="1" r:id="rId7"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId7" Target="worksheets/sheet3.xml"/></Relationships>'),
    "xl/worksheets/sheet3.xml": strToU8(`<worksheet><sheetData>${formulas}</sheetData></worksheet>`),
  })
}

test("formula and stored result remain distinct at the original sheet and cell", async () => {
  const bytes = workbookZip('<row r="4"><c r="B4"><f>B2-B3</f><v>40</v></c></row>')
  const blocks = await extractXlsxFormulaEvidence("source", bytes)
  expect(blocks).toHaveLength(1)
  expect(blocks[0]?.locator).toEqual({ kind: "cell", sheet: "Budget 2027", address: "B4" })
  expect(blocks[0]?.content).toContain("=B2-B3")
  expect(blocks[0]?.content).toContain("40")
  expect(blocks[0]?.content).toContain("stored, not recalculated")
})

test("an absent cached value stays unknown instead of becoming a calculated zero", async () => {
  const bytes = workbookZip('<row r="4"><c r="B4"><f>B2-B3</f><v></v></c></row>')
  const blocks = await extractXlsxFormulaEvidence("source", bytes)
  expect(blocks[0]?.content).toContain("unavailable")
  expect(blocks[0]?.content).not.toContain("result: 0")
})

test("the small checked-in workbook keeps both cached and uncached formulas", async () => {
  const bytes = new Uint8Array(await readFile(new URL("../../../../sample-input-items/budget.xlsx", import.meta.url)))
  const blocks = await extractXlsxFormulaEvidence("source", bytes)
  expect(blocks.map(block => block.locator.kind === "cell" ? block.locator.address : "")).toEqual(["B4", "B5"])
  expect(blocks[0]?.content).toContain("40 (stored, not recalculated)")
  expect(blocks[1]?.content).toContain("unavailable (not recalculated)")
})

test("original workbook cells stay distinct from a converter's recalculated page", async () => {
  const bytes = new Uint8Array(await readFile(new URL("../../../../sample-input-items/budget.xlsx", import.meta.url)))
  const blocks = await extractXlsxSourceEvidence("source", bytes)
  expect(blocks.some(block => block.locator.kind === "cell" && block.locator.address === "B2" && block.content.includes("120"))).toBe(true)
  expect(blocks.some(block => block.locator.kind === "cell" && block.locator.address === "B3" && block.content.includes("80"))).toBe(true)
  expect(blocks.some(block => block.locator.kind === "cell" && block.locator.address === "B5" && block.content.includes("unavailable"))).toBe(true)
  expect(blocks.some(block => block.content.includes("200"))).toBe(false)
})

test("archive path traversal and oversized worksheet parts fail before extraction", async () => {
  const escaped = zipSync({
    "xl/workbook.xml": strToU8('<workbook><sheets><sheet name="Bad" r:id="rId1"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Target="../../outside.xml"/></Relationships>'),
  })
  await expect(extractXlsxFormulaEvidence("source", escaped)).rejects.toThrow("Worksheet")
  const oversized = workbookZip(`<row r="1"><c r="A1"><f>${"A".repeat(4 * 1024 * 1024)}</f></c></row>`)
  await expect(extractXlsxFormulaEvidence("source", oversized)).rejects.toThrow("limit")
})
