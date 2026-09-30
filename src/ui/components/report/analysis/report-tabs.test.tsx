/**
 * Purpose: Verify accepted reports use inline outcome reports while saved SWOT remains readable.
 * Pattern: Static rendering and boundary contract tests.
 * Usage: bun test src/ui/components/report/analysis/report-tabs.test.tsx
 * Related: src/ui/components/report/analysis/report-tabs.tsx, src/shared/analytical-report-schema.ts
 */
import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { ANALYSIS_SECTIONS, LEGACY_ANALYSIS_SECTIONS, type AnalysisRecord, type StoredAnalysisSectionId } from "@/shared/analytical-report"
import { analyticalReportSchema } from "@/shared/analytical-report-schema"
import { dictionary } from "@/ui/i18n/dictionary"
import { ReportReadingTabs } from "./report-tabs"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

function record(ids: readonly StoredAnalysisSectionId[], batch = false): AnalysisRecord {
  return { id: "report", subject: { kind: batch ? "batch" : "run", id: "run" }, inputRevision: "test", language: "ko", fastMode: false,
    createdAt: "2026-09-30T00:00:00.000Z", deadlineAt: "2026-09-30T01:00:00.000Z", maxCalls: 100, status: "ready", report: {
      perspective: { focus: "회의", objective: "판단", horizon: "현재", boundary: "내부", evidenceIds: [] },
      coverage: { requested: 1, completed: 1, analyzed: 1, failed: 0, canceled: 0, interrupted: 0 },
      trajectories: { categories: [], unclassifiedWorldIds: [] }, unavailableInputs: [], evidenceIds: [],
      sections: ids.map(id => ({ id, status: "ready", summary: "결정이 보류되었습니다.", content: "추가 근거가 필요합니다.", findings: [], evidenceIds: [] })),
    } }
}
test("single-run report shows outcomes and turning points without SWOT or distribution", () => {
  const value = record(ANALYSIS_SECTIONS.filter(id => id !== "trajectories"))
  expect(analyticalReportSchema.safeParse(value.report).success).toBe(true)
  const html = renderReport(value, "ko")
  expect(html).toContain('role="tablist"')
  expect(html).toContain('role="tabpanel"')
  expect(html).toContain("추가 근거가 필요합니다.")
  expect(html).not.toContain('aria-haspopup="dialog"')
  expect(html).toContain('>핵심 결과<')
  expect(html).toContain('>주요 전개와 전환점<')
  expect(html).not.toContain('>강점<')
  expect(html).not.toContain('report-radar')
  expect(html).not.toContain(`>${dictionary.ko.analysisTrajectories}<`)
})
test("batch adds development distribution and old saved sections keep their original identities", () => {
  const batch = record(ANALYSIS_SECTIONS, true)
  expect(analyticalReportSchema.safeParse(batch.report).success).toBe(true)
  expect(renderReport(batch, "en")).toContain(`>${dictionary.en.analysisTrajectories}<`)
  const old = record(LEGACY_ANALYSIS_SECTIONS)
  expect(analyticalReportSchema.safeParse(old.report).success).toBe(true)
  expect(renderReport(old, "ko")).toContain('>강점<')
  if (!old.report) throw new Error("Missing fixture report")
  old.report.sections.push(old.report.sections[0]!)
  expect(analyticalReportSchema.safeParse(old.report).success).toBe(false)
})

function renderReport(value: AnalysisRecord, locale: "en" | "ko") {
  return renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><ReportReadingTabs record={value} t={dictionary[locale]} /></QueryClientProvider>)
}
