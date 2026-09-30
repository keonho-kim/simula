/**
 * Purpose: Verify current report sections have semantic labels and generation stages.
 * Pattern: Pure presentation contract tests.
 * Usage: bun test src/ui/models/report/analytical-view.test.ts
 * Related: src/ui/models/report/analytical-view.ts
 */
import { expect, test } from "bun:test"
import { analysisTaskStage, analysisTaskLabel } from "./analytical-view"
import { dictionary } from "@/ui/i18n/dictionary"

test("analysis detail belongs to synthesis while evidence and findings retain separate stages", () => {
  const task = { type: "task" as const, taskId: "outcomes-detail", kind: "report-detail" as const, attempt: 1, status: "running" as const }
  expect(analysisTaskStage(task)).toBe("synthesis")
  expect(analysisTaskStage({ ...task, kind: "report-evidence" })).toBe("evidence")
  expect(analysisTaskStage({ ...task, kind: "assessment" })).toBe("analysis")
})

test("conclusion tasks and their checks expose distinct readable synthesis labels", () => {
  const task = { type: "task" as const, taskId: "conclusion-source", kind: "conclusion" as const, attempt: 1, status: "running" as const }
  expect(analysisTaskLabel(task, dictionary.ko)).toBe("자료 평가")
  expect(analysisTaskLabel({ ...task, taskId: "conclusion-observations" }, dictionary.ko)).toBe("시뮬레이션 관찰")
  expect(analysisTaskLabel({ ...task, taskId: "conclusion-implications" }, dictionary.ko)).toBe("자료 보완점과 확인 과제")
  expect(analysisTaskStage({ ...task, taskId: "conclusion-source-claim-summary", kind: "check" })).toBe("synthesis")
})
