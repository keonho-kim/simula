/**
 * Purpose: Prevent implicit regeneration of saved reports and retries of failed work.
 * Pattern: Report-stage policy tests.
 * Usage: Executed by bun test.
 * Related: src/ui/models/report/preparation.ts
 */
import { expect, test } from "bun:test"
import type { AnalysisRecord } from "@/shared/analytical-report"
import { hasReportResult, shouldPrepareReport } from "./preparation"

const record: AnalysisRecord = { id: "report", subject: { kind: "run", id: "run" }, inputRevision: "one",
  language: "en", fastMode: false, createdAt: "2026-09-28", deadlineAt: "2026-09-28", maxCalls: 100, status: "ready",
  report: { perspective: { focus: "", objective: "", horizon: "", boundary: "", evidenceIds: [] },
    coverage: { requested: 1, completed: 1, failed: 0, canceled: 0, interrupted: 0, analyzed: 1 },
    trajectories: { categories: [], unclassifiedWorldIds: [] }, sections: [], evidenceIds: [], unavailableInputs: [] } }

test("saved accepted reports open as results without model work, including offline and partial results", () => {
  for (const freshness of ["current", "unavailable"] as const) {
    for (const status of ["ready", "partial"] as const) {
      const lookup = { analysis: { ...record, status }, freshness }
      expect(hasReportResult(lookup)).toBe(true)
      expect(shouldPrepareReport(lookup)).toBe(false)
    }
  }
})
test("missing and outdated reports prepare, while running and failed work do not start another job", () => {
  expect(shouldPrepareReport(undefined)).toBe(false)
  expect(shouldPrepareReport({ analysis: null, freshness: null })).toBe(true)
  expect(shouldPrepareReport({ analysis: record, freshness: "outdated" })).toBe(true)
  expect(hasReportResult({ analysis: record, freshness: "outdated" })).toBe(false)
  for (const status of ["running", "failed", "canceled"] as const) {
    const lookup = { analysis: { ...record, report: undefined, status }, freshness: "current" as const }
    expect(hasReportResult(lookup)).toBe(false)
    expect(shouldPrepareReport(lookup)).toBe(false)
  }
})
