/**
 * Purpose: Verify report evidence displays a source workbook cell without losing its sheet.
 * Pattern: Presentation contract test.
 * Usage: bun test src/ui/models/report/reference-location.test.ts
 * Related: src/ui/models/report/reference-location.ts, src/shared/documents.ts
 */
import { expect, test } from "bun:test"
import { dictionary } from "@/ui/i18n/dictionary"
import { referenceLocation } from "./reference-location"

test("formula evidence displays its sheet and precise cell", () => {
  expect(referenceLocation({ id: "formula", category: "source_claim", text: "Formula =B2-B3",
    locator: { kind: "cell", sheet: "Budget 2027", address: "B4" } }, dictionary.en)).toBe("Budget 2027 · B4")
})
