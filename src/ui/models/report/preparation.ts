/**
 * Purpose: Decide whether a report needs preparation or can show retained results.
 * Pattern: Pure presentation policy.
 * Usage: Called by the report page before mounting generation or result views.
 * Related: src/ui/pages/report-page.tsx, src/shared/analytical-report.ts
 */
import type { AnalysisLookup } from "@/shared/analytical-report"

export function hasReportResult(lookup: AnalysisLookup | undefined): boolean {
  return Boolean(lookup?.analysis?.report && lookup.analysis.status !== "running" && lookup.freshness !== "outdated")
}

export function shouldPrepareReport(lookup: AnalysisLookup | undefined): boolean {
  if (!lookup || lookup.freshness === "unavailable" || lookup.analysis?.status === "running") return false
  return !lookup.analysis || lookup.freshness === "outdated"
}
