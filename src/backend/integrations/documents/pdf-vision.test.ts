/**
 * Purpose: Verify selectable-text priority and image-only PDF interpretation.
 * Pattern: Adapter contract test.
 * Usage: bun test src/backend/integrations/documents/pdf-vision.test.ts
 * Related: src/backend/integrations/documents/pdf-vision.ts, sample-input-items/README.md
 */
import { expect, test } from "bun:test"
import { resolve } from "node:path"
import { interpretPdfPages } from "./pdf-vision"

const fixture = (name: string) => resolve(import.meta.dir, "../../../../sample-input-items", name)

test("sends selectable text and the same rendered page image to the vision model", async () => {
  const prompts: string[] = []
  const extraction = await interpretPdfPages("source", fixture("overview.pdf"), false, 2, async (prompt, image) => {
    prompts.push(prompt)
    expect(image.mimeType).toBe("image/png")
    expect([...image.bytes.slice(0, 4)]).toEqual([137, 80, 78, 71])
    return "The decision is a May launch; Costs 80."
  })
  expect(prompts).toHaveLength(1)
  expect(prompts[0]).toContain("Costs")
  expect(prompts[0]).toContain("80")
  expect(prompts[0]).toContain("do not attempt exhaustive OCR")
  expect(extraction.blocks.some(block => block.method === "pdfjs" && block.content.includes("Costs"))).toBe(true)
  expect(extraction.blocks.some(block => block.method === "vlm" && block.content.includes("Costs 80"))).toBe(true)
  expect(extraction.coverage).toMatchObject({ totalUnits: 1, processedUnits: 1, failedUnits: 0 })
})

test("a conflicting visual number cannot replace selectable text", async () => {
  const extraction = await interpretPdfPages("source", fixture("overview.pdf"), false, 1, async () => "Costs 0")
  expect(extraction.blocks.some(block => block.method === "pdfjs" && block.content.includes("80"))).toBe(true)
  expect(extraction.blocks.some(block => block.method === "vlm")).toBe(false)
  expect(extraction.issues.some(issue => issue.code === "visual_number_unverified")).toBe(true)
  expect(extraction.coverage.failedUnits).toBe(0)
})

test("rejects only the unsupported visual line and keeps other page findings", async () => {
  const extraction = await interpretPdfPages("source", fixture("overview.pdf"), false, 1,
    async () => "Costs 0\nThe title is underlined in blue.")
  expect(extraction.blocks.some(block => block.method === "vlm" && block.content.includes("underlined in blue"))).toBe(true)
  expect(extraction.blocks.some(block => block.method === "vlm" && block.content.includes("Costs 0"))).toBe(false)
})

test("an image-only PDF still reaches the vision model with empty selectable text", async () => {
  const extraction = await interpretPdfPages("source", fixture("scanned-note.pdf"), false, 1, async (prompt, image) => {
    expect(prompt).toContain("[No selectable text on this page]")
    expect(image.bytes.length).toBeGreaterThan(100)
    return "Launch on May 12 with a 120 million KRW budget."
  })
  expect(extraction.blocks.some(block => block.method === "vlm" && block.content.includes("120"))).toBe(true)
  expect(extraction.coverage).toMatchObject({ totalUnits: 1, processedUnits: 1, failedUnits: 0 })
})

test("vision failure retains selectable text and reports partial coverage", async () => {
  const extraction = await interpretPdfPages("source", fixture("overview.pdf"), false, 1, async () => { throw new Error("offline") })
  expect(extraction.blocks.some(block => block.method === "pdfjs" && block.content.includes("80"))).toBe(true)
  expect(extraction.coverage.failedUnits).toBe(1)
  expect(extraction.issues[0]?.code).toBe("page_vision_failed")
})

test("original workbook evidence overrides a recalculated rendered PDF value", async () => {
  const source = "Budget B2: Value 120\nBudget B3: Value 80\nBudget B5: Formula =B2+B3; Cached result unavailable"
  const extraction = await interpretPdfPages("source", fixture("overview.pdf"), false, 1, async prompt => {
    expect(prompt).toContain("Original workbook cells")
    expect(prompt).toContain("Cached result unavailable")
    return "Uncached result 200"
  }, undefined, source)
  expect(extraction.blocks).toHaveLength(0)
})
