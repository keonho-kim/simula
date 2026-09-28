/**
 * Purpose: Render one report generation stage as an inspectable task column.
 * Pattern: Presentational component.
 * Usage: Composed by the report preparation board for overview and detail navigation.
 * Related: src/ui/components/report/analysis/activity.tsx, src/ui/models/report/analytical-view.ts
 */
import * as m from "motion/react-m"
import { Button } from "@/ui/components/ui/button"
import { activeRowMotion } from "@/ui/animation/activity"
import { analysisTaskLabel, analysisLabel, type REPORT_STAGES } from "@/ui/models/report/analytical-view"
import { builderLabel } from "@/ui/models/scenario-builder/labels"
import type { GenerationTaskView } from "@/ui/models/generation/progress"
import type { UiTexts } from "@/ui/types/i18n"

export function PreparationColumn({ stage, tasks, selectedId, onSelect, moving, running, t }: {
  stage: typeof REPORT_STAGES[number]
  tasks: GenerationTaskView[]
  selectedId?: string
  onSelect: (id: string) => void
  moving: boolean
  running: boolean
  t: UiTexts
}) {
  const active = tasks.find(task => task.status === "running" || task.status === "retrying")
  const completed = tasks.filter(task => task.status === "completed").length
  const status = tasks.some(task => task.status === "failed") ? "failed" : active && running ? "running"
    : tasks.length > 0 && completed === tasks.length ? "completed" : "waiting"
  return <section className="report-preparation-column" aria-label={analysisLabel(stage, t)}>
    <h3 className="flex items-center gap-2 rounded-sm bg-muted/60 px-3 py-2 text-sm font-medium">
      <span className="report-preparation-indicator" data-status={status} aria-label={builderLabel(status, t)} />
      <span className="min-w-0 flex-1">{analysisLabel(stage, t)}</span>
      <span className="font-mono text-xs text-muted-foreground">{completed}/{tasks.length}</span>
    </h3>
    <div className="flex flex-col gap-2">
      {tasks.length ? tasks.map(task => <Button key={task.taskId} variant="outline"
        className="report-preparation-task" data-task-id={task.taskId} aria-pressed={selectedId === task.taskId}
        disabled={task.status === "waiting"} onClick={() => onSelect(task.taskId)}>
        {task.taskId === active?.taskId && running ? <m.span aria-hidden="true"
          className="report-preparation-highlight" {...activeRowMotion(moving)} /> : null}
        <span className="report-preparation-marker" data-status={task.status} aria-hidden="true">
          {task.status === "completed" ? "✓" : task.status === "failed" ? "!" : task.status === "running" || task.status === "retrying" ? "▸" : "·"}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span>{analysisTaskLabel(task, t)}</span>
          <span className="text-xs text-muted-foreground">{builderLabel(!running && (task.status === "running" || task.status === "retrying") ? "canceled" : task.status, t)}</span>
        </span>
      </Button>) : <p className="p-3 text-xs text-muted-foreground">{t.analysisPending}</p>}
    </div>
  </section>
}
