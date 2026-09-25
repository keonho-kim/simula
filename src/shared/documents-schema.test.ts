/**
 * Purpose: Verify supported document evidence methods at shared persistence boundaries.
 * Pattern: Contract test.
 * Usage: bun test src/shared/documents-schema.test.ts
 * Related: src/shared/documents-schema.ts, src/shared/analytical-report-schema.ts
 */
import { expect, test } from "bun:test"
import { analysisReferenceSchema } from "./analytical-report-schema"
import { extractionSchema } from "./documents-schema"

const evidence = {
  id: "source:page:1:text:1", documentId: "source", kind: "text", method: "pdfjs",
  content: "Source text", locator: { kind: "page", page: 1, element: "#/pages/1/text" },
}

test("document evidence accepts current methods and rejects the retired Docling method", () => {
  const extraction = { blocks: [evidence], coverage: { unit: "regions", totalUnits: 1,
    processedUnits: 1, skippedUnits: 0, failedUnits: 0 }, issues: [] }
  expect(extractionSchema.safeParse(extraction).success).toBe(true)
  expect(extractionSchema.safeParse({ ...extraction, blocks: [{ ...evidence, method: "docling" }] }).success).toBe(false)
})

test("report references reject the retired Docling method", () => {
  const reference = { id: "reference-1", category: "source_claim", text: "Source text",
    documentId: crypto.randomUUID(), method: "pdfjs", sourceKind: "text", locator: evidence.locator }
  expect(analysisReferenceSchema.safeParse(reference).success).toBe(true)
  expect(analysisReferenceSchema.safeParse({ ...reference, method: "docling" }).success).toBe(false)
})
