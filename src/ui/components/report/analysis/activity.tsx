/**
 * Purpose: Present report preparation stages with one selected live task detail.
 * Pattern: Scoped generation composition.
 * Usage: Mounted only by the report preparation page while analysis is running.
 * Related: src/ui/hooks/use-generation-stream.ts, src/ui/components/report/analysis/task-output.tsx
 */
import { useState } from "react"
import { useGenerationStream } from "@/ui/hooks/use-generation-stream"
import { analysisTaskLabel, analysisTaskStage, analysisLabel, REPORT_STAGES } from "@/ui/models/report/analytical-view"
import { Button } from "@/ui/components/ui/button"
import { builderLabel } from "@/ui/models/scenario-builder/labels"
import type { UiTexts } from "@/ui/types/i18n"
import { LiveSwotRadar } from "./live-radar"
import { AnalysisTaskOutput } from "./task-output"

export function AnalysisActivity({ id, t }: { id: string; t: UiTexts }) {
  const progress = useGenerationStream(id, undefined, true, "analysis")
  const [selectedStage, setStage] = useState<typeof REPORT_STAGES[number]>()
  const [selectedId, setSelectedId] = useState<string>()
  const stage = selectedStage ?? REPORT_STAGES.reduce((current, stage) => progress.tasks.some(task => analysisTaskStage(task) === stage) ? stage : current, REPORT_STAGES[0])
  const tasks = progress.tasks.filter(task => analysisTaskStage(task) === stage).toSorted((a, b) => a.taskId.localeCompare(b.taskId))
  const selected = tasks.find(task => task.taskId === selectedId)
    ?? tasks.find(task => task.status === "running" || task.status === "retrying") ?? tasks.at(-1)
  return <section className="flex min-w-0 flex-col gap-4" aria-label={t.analysisLive}>
    <nav className="report-stage-timeline" aria-label={t.analysisPreparing}>
      {REPORT_STAGES.map(value => <Button key={value} variant={stage === value ? "secondary" : "ghost"}
        aria-pressed={stage === value} onClick={() => { setStage(value); setSelectedId(undefined) }}>{analysisLabel(value, t)}</Button>)}
    </nav>
    {progress.disconnected ? <p role="status" className="text-sm text-muted-foreground">{t.builderReconnecting}</p> : null}
    <div className="flex min-w-0 flex-col gap-4 md:flex-row">
      <div className="flex min-w-0 flex-col gap-1 md:w-1/3" aria-label={analysisLabel(stage, t)}>
        {tasks.map(task => <Button key={task.taskId} variant={selected?.taskId === task.taskId ? "secondary" : "ghost"}
          className="h-auto justify-start whitespace-normal py-3 text-left" aria-pressed={selected?.taskId === task.taskId}
          onClick={() => { setStage(stage); setSelectedId(task.taskId) }}>
          <span className="flex min-w-0 flex-1 flex-col gap-1"><span>{analysisTaskLabel(task, t)}</span>
            <span className="text-xs text-muted-foreground">{builderLabel(task.status, t)}</span></span>
          {task.status === "completed" ? <span aria-hidden="true">✓</span> : null}
        </Button>)}
      </div>
      <div className="min-w-0 flex-1 rounded-lg border bg-card p-4" aria-label={t.analysisContent}>
        {selected ? <><h2 className="mb-3 text-sm font-semibold">{analysisTaskLabel(selected, t)}</h2>
          <AnalysisTaskOutput key={selected.taskId} reportId={id} task={selected} t={t} /></>
          : <p role="status" className="text-sm text-muted-foreground">{t.builderNoPreview}</p>}
      </div>
    </div>
    <LiveSwotRadar reportId={id} tasks={progress.tasks} t={t} />
  </section>
}
