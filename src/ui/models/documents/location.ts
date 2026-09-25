/**
 * Purpose: Format a document evidence locator for browser reading.
 * Pattern: Pure presentation function.
 * Usage: Shared by scenario source review and analytical report references.
 * Related: src/shared/documents.ts, src/ui/models/report/reference-location.ts
 */
import type { SourceLocator } from "@/shared/documents"
import type { UiTexts } from "@/ui/types/i18n"

export function documentSourceLocation(locator: SourceLocator, t: UiTexts): string {
  if (locator.kind === "page") return t.analysisPage.replace("{page}", String(locator.page))
  if (locator.kind === "text") return t.analysisLines.replace("{start}", String(locator.startLine)).replace("{end}", String(locator.endLine))
  if (locator.kind === "table") return `${locator.sheet ?? ""} ${t.analysisRows.replace("{start}", String(locator.startRow)).replace("{end}", String(locator.endRow))}`.trim()
  if (locator.kind === "cell") return `${locator.sheet} · ${locator.address}`
  return locator.element
}
