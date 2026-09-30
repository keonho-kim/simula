/**
 * Purpose: Verify preparation starts as three task columns without mounting live detail content.
 * Pattern: Server-rendered presentation contract test.
 * Usage: Executed by bun test.
 * Related: src/ui/components/report/analysis/activity.tsx
 */
import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { dictionary } from "@/ui/i18n/dictionary"
import { PreparationTaskList } from "./preparation-task-list"
import { groupPreparationTasks } from "@/ui/models/report/preparation-groups"
import { ReportPreparationBoard } from "./activity"
import type { GenerationTaskView } from "@/ui/models/generation/progress"

const tasks: GenerationTaskView[] = [
  { type: "task", taskId: "perspective", kind: "perspective", attempt: 1, status: "completed" },
  { type: "task", taskId: "outcomes-summary", kind: "assessment", attempt: 1, status: "running" },
  { type: "task", taskId: "conclusion-source", kind: "conclusion", attempt: 1, status: "waiting" },
]
for (const locale of ["en", "ko"] as const) test(`overview shows all stages and clickable task status without streaming bodies (${locale})`, () => {
  const t = dictionary[locale]
  const html = renderToStaticMarkup(<ReportPreparationBoard reportId="report" tasks={tasks} running t={t} />)
  expect(html.match(/class="report-preparation-column"/g)).toHaveLength(3)
  expect(html).toContain(t.analysisEvidenceStage)
  expect(html).toContain(t.analysisFindingsStage)
  expect(html).toContain(t.analysisSynthesisStage)
  expect(html).toContain('data-status="completed"')
  expect(html).toContain('data-status="running"')
  expect(html).toContain('data-group-id="analysis:outcomes"')
  expect(html).not.toContain('data-task-id=')
  expect(html).not.toContain('report-task-output')
  expect(html).not.toContain('report-chart-wait')
})


test("parallel perspective fields occupy one overview card and get separate subtitles inside", () => {
  const t = dictionary.ko
  const fields = ["focus", "objective", "horizon", "boundary"].map(field => ({ ...tasks[0]!, taskId: `perspective-${field}` }))
  const html = renderToStaticMarkup(<ReportPreparationBoard reportId="report" tasks={fields} running t={t} />)
  expect(html.match(/data-group-id="evidence:perspective"/g)).toHaveLength(1)
  expect(html).not.toContain("분석 대상")
  expect(html).toContain('aria-valuenow="100"')
  const group = groupPreparationTasks(fields, true, t)[0]!
  const opened = renderToStaticMarkup(<PreparationTaskList group={group} onSelect={() => {}} moving={false} running t={t} />)
  for (const title of ["분석 대상", "평가 목적", "평가 기간", "평가 범위"]) expect(opened).toContain(title)
  expect(opened).not.toContain("report-task-output")
})
