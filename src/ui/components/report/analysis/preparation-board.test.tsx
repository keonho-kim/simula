/**
 * Purpose: Verify preparation starts as three task columns without mounting live detail content.
 * Pattern: Server-rendered presentation contract test.
 * Usage: Executed by bun test.
 * Related: src/ui/components/report/analysis/activity.tsx
 */
import { expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { dictionary } from "@/ui/i18n/dictionary"
import { ReportPreparationBoard } from "./activity"
import type { GenerationTaskView } from "@/ui/models/generation/progress"

const tasks: GenerationTaskView[] = [
  { type: "task", taskId: "perspective", kind: "perspective", attempt: 1, status: "completed" },
  { type: "task", taskId: "strengths-summary", kind: "swot", attempt: 1, status: "running" },
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
  expect(html).toContain('data-task-id="strengths-summary"')
  expect(html).not.toContain('report-task-output')
  expect(html).not.toContain('report-chart-wait')
})
