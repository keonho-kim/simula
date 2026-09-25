/**
 * Purpose: Verify missing SWOT data cannot become a misleading polygon and task stages remain semantic.
 * Pattern: Pure presentation contract tests.
 * Usage: bun test src/ui/models/report/analytical-view.test.ts
 * Related: src/ui/models/report/analytical-view.ts
 */
import { expect, test } from "bun:test"
import type { AnalysisSection } from "@/shared/analytical-report"
import { radarPoints, SWOT_SECTIONS, analysisTaskStage, analysisTaskLabel } from "./analytical-view"
import { dictionary } from "@/ui/i18n/dictionary"

test("radar distinguishes supported zero from unknown or failed assessments", () => {
  const sections: AnalysisSection[] = SWOT_SECTIONS.map(id => ({ id, status: "ready", summary: "Accepted", content: "Details", findings: [], evidenceIds: [], score: { value: 2, rationale: "Measured influence", evidenceIds: ["source"] } }))
  expect(radarPoints(sections)).toBe("120.0,80.0 160.0,120.0 120.0,160.0 80.0,120.0")
  sections[0]!.score!.value = 0
  expect(radarPoints(sections)).toStartWith("120.0,120.0")
  sections[0]!.score!.value = null
  expect(radarPoints(sections)).toBeUndefined()
  sections[0]!.score!.value = 4
  sections[0]!.status = "failed"
  expect(radarPoints(sections)).toBeUndefined()
})

test("analysis detail belongs to synthesis while evidence and findings retain separate stages", () => {
  const task = { type: "task" as const, taskId: "strengths-detail", kind: "report-detail" as const, attempt: 1, status: "running" as const }
  expect(analysisTaskStage(task)).toBe("synthesis")
  expect(analysisTaskStage({ ...task, kind: "report-evidence" })).toBe("evidence")
  expect(analysisTaskStage({ ...task, kind: "swot" })).toBe("analysis")
})

test("conclusion tasks and their checks expose distinct readable synthesis labels", () => {
  const task = { type: "task" as const, taskId: "conclusion-source", kind: "conclusion" as const, attempt: 1, status: "running" as const }
  expect(analysisTaskLabel(task, dictionary.ko)).toBe("자료 평가")
  expect(analysisTaskLabel({ ...task, taskId: "conclusion-observations" }, dictionary.ko)).toBe("시뮬레이션 관찰")
  expect(analysisTaskLabel({ ...task, taskId: "conclusion-implications" }, dictionary.ko)).toBe("시사점·확인 과제")
  expect(analysisTaskStage({ ...task, taskId: "conclusion-source-claim-summary", kind: "check" })).toBe("synthesis")
})
