/**
 * Purpose: Describe an analytical reference's portable source location for reading or export.
 * Pattern: Pure presentation function.
 * Usage: Shared by report evidence dialogs and Markdown export.
 * Related: src/shared/analytical-report.ts, src/ui/models/documents/location.ts
 */
import type { AnalysisReference } from "@/shared/analytical-report"
import type { UiTexts } from "@/ui/types/i18n"
import { documentSourceLocation } from "@/ui/models/documents/location"

export function referenceLocation(reference: AnalysisReference, t: UiTexts): string {
  if (reference.locator) return documentSourceLocation(reference.locator, t)
  const scope = reference.runId ? t.analysisRunReference.replace("{id}", reference.runId) : t.analysisPerspective
  return reference.roundIndex !== undefined ? `${scope} · ${t.round} ${reference.roundIndex}` : scope
}
