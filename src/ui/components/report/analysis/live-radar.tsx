/**
 * Purpose: Reveal SWOT geometry as soon as its four accepted score tasks are available.
 * Pattern: Accepted-task projection with bounded parallel queries.
 * Usage: Mounted by live analytical activity independently of final prose completion.
 * Related: src/ui/components/report/analysis/radar.tsx, src/shared/analytical-report-schema.ts
 */
import * as m from "motion/react-m"
import { useQueries } from "@tanstack/react-query"
import { fetchGenerationTask } from "@/ui/api-client/generation"
import { analysisScoreSchema } from "@/shared/analytical-report-schema"
import type { AnalysisSection } from "@/shared/analytical-report"
import type { GenerationTaskView } from "@/ui/models/generation/progress"
import type { UiTexts } from "@/ui/types/i18n"
import { SWOT_SECTIONS } from "@/ui/models/report/analytical-view"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { motionTransition } from "@/ui/animation/timing"
import { SwotRadar } from "./radar"

export function LiveSwotRadar({ reportId, tasks, t }: { reportId: string; tasks: GenerationTaskView[]; t: UiTexts }) {
  const scores = useQueries({ queries: SWOT_SECTIONS.map(id => {
    const task = tasks.find(task => task.taskId === `${id}-score`)
    return { queryKey: ["analysis-score", reportId, id, task?.attempt], enabled: task?.status === "completed", retry: false,
      queryFn: async ({ signal }: { signal: AbortSignal }) => analysisScoreSchema.parse(await fetchGenerationTask(reportId, `${id}-score`, signal, "analysis")) }
  }) })
  if (scores.some(score => !score.data)) return <ChartWait t={t} />
  const sections: AnalysisSection[] = SWOT_SECTIONS.map((id, index) => ({ id, status: "ready", summary: "", content: "", findings: [], evidenceIds: [], score: scores[index]?.data }))
  return <SwotRadar sections={sections} t={t} />
}

function ChartWait({ t }: { t: UiTexts }) {
  const reducedMotion = useReducedMotionPreference()
  return <div className="report-chart-wait" role="status"><m.span className="report-chart-wait-mark" aria-hidden="true"
    initial={{ opacity: reducedMotion ? 1 : 0.25 }} animate={{ opacity: 1 }}
    transition={motionTransition(reducedMotion, "reveal")} />{t.analysisChartPending}</div>
}
