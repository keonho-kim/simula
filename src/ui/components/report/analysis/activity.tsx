/**
 * Purpose: Show report stages, bounded task headers, and their independently streamed outputs.
 * Pattern: Scoped generation composition with paged output mounting.
 * Usage: Mounted while analytical generation is active.
 * Related: src/ui/hooks/use-generation-stream.ts, src/ui/components/report/analysis/task-output.tsx
 */
import { useState } from "react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { useGenerationStream } from "@/ui/hooks/use-generation-stream"
import { analysisTaskLabel, analysisTaskStage, analysisLabel, REPORT_STAGES } from "@/ui/models/report/analytical-view"
import { Button } from "@/ui/components/ui/button"
import { builderLabel } from "@/ui/models/scenario-builder/labels"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { slidePresence } from "@/ui/animation/presence"
import type { UiTexts } from "@/ui/types/i18n"
import { LiveSwotRadar } from "./live-radar"
import { AnalysisTaskOutput } from "./task-output"

const VISIBLE_TASKS = 3
export function AnalysisActivity({ id, t }: { id: string; t: UiTexts }) {
  const reducedMotion = useReducedMotionPreference()
  const progress = useGenerationStream(id, undefined, true, "analysis")
  const [selectedStage, setStage] = useState<typeof REPORT_STAGES[number]>()
  const [offset, setOffset] = useState(0)
  const stage = selectedStage ?? REPORT_STAGES.reduce((current, stage) => progress.tasks.some(task => analysisTaskStage(task) === stage) ? stage : current, REPORT_STAGES[0])
  const tasks = progress.tasks.filter(task => analysisTaskStage(task) === stage).toSorted((a, b) => a.taskId.localeCompare(b.taskId))
  const start = Math.min(offset, Math.max(0, tasks.length - VISIBLE_TASKS))
  return <section className="flex min-w-0 flex-col gap-3 rounded-lg border p-4" aria-label={t.analysisLive}>
    <nav className="report-stage-timeline" aria-label={t.analysisLive}>{REPORT_STAGES.map(value => <Button key={value} variant={stage === value ? "secondary" : "ghost"} aria-pressed={stage === value} onClick={() => { setStage(value); setOffset(0) }}>{analysisLabel(value, t)}</Button>)}</nav>
    <div className="flex items-center justify-between gap-2"><p role="status" className="text-xs text-muted-foreground">{progress.disconnected ? t.builderReconnecting : t.builderDraftNotice}</p>
      <div className="flex gap-1"><Button size="sm" variant="ghost" disabled={start === 0} onClick={() => setOffset(Math.max(0, start - VISIBLE_TASKS))}>{t.analysisPrevious}</Button><Button size="sm" variant="ghost" disabled={start + VISIBLE_TASKS >= tasks.length} onClick={() => setOffset(start + VISIBLE_TASKS)}>{t.analysisNext}</Button></div>
    </div>
    <LiveSwotRadar reportId={id} tasks={progress.tasks} t={t} />
    <div className="report-live-columns"><AnimatePresence initial={false}>{tasks.slice(start, start + VISIBLE_TASKS).map((task, index) => <m.article key={task.taskId}
      {...slidePresence(reducedMotion, "y", 6, -6)}
      className="report-live-task" data-status={task.status}>
      <header className="flex flex-col gap-2 border-b p-3"><h3 className="flex items-center gap-2 text-sm font-medium"><span className="report-task-indicator" aria-hidden="true">{task.status === "completed" ? "✓" : ""}</span>{analysisTaskLabel(task, t)}</h3><p className="text-xs text-muted-foreground">{t.analysisTask.replace("{index}", String(start + index + 1))} · {builderLabel(task.status, t)}</p></header>
      <AnalysisTaskOutput reportId={id} task={task} t={t} />
    </m.article>)}</AnimatePresence></div>
  </section>
}
