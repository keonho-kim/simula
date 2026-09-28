/**
 * Purpose: Present report generation as a kanban board with opt-in live task details.
 * Pattern: Scoped subscription and master-detail composition.
 * Usage: Mounted only by the report preparation page.
 * Related: src/ui/components/report/analysis/preparation-column.tsx, src/ui/components/report/analysis/task-output.tsx
 */
import { useEffect, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import * as m from "motion/react-m"
import { useGenerationStream } from "@/ui/hooks/use-generation-stream"
import { analysisTaskLabel, analysisTaskStage, REPORT_STAGES } from "@/ui/models/report/analytical-view"
import { Button } from "@/ui/components/ui/button"
import type { UiTexts } from "@/ui/types/i18n"
import type { GenerationTaskView } from "@/ui/models/generation/progress"
import { useDocumentVisible } from "@/ui/animation/use-document-visible"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { fadePresence, slidePresence } from "@/ui/animation/presence"
import { LiveSwotRadar } from "./live-radar"
import { AnalysisTaskOutput } from "./task-output"
import { PreparationColumn } from "./preparation-column"

export function AnalysisActivity({ id, running, t }: { id?: string; running: boolean; t: UiTexts }) {
  const progress = useGenerationStream(id ?? "", undefined, Boolean(id), "analysis")
  return <section className="flex min-w-0 flex-col gap-4" aria-label={t.analysisLive}>
    {progress.disconnected ? <p role="status" className="text-sm text-muted-foreground">{t.builderReconnecting}</p> : null}
    <ReportPreparationBoard reportId={id} tasks={progress.tasks} running={running} t={t} />
  </section>
}

export function ReportPreparationBoard({ reportId, tasks, running, t }: {
  reportId?: string; tasks: GenerationTaskView[]; running: boolean; t: UiTexts
}) {
  const [selectedId, setSelectedId] = useState<string>()
  const root = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLButtonElement>(null)
  const returnTask = useRef<string | undefined>(undefined)
  const visible = useDocumentVisible()
  const reduced = useReducedMotionPreference()
  const still = reduced || !visible
  const selected = tasks.find(task => task.taskId === selectedId)
  const stage = selected && analysisTaskStage(selected)
  const closeDetails = () => {
    returnTask.current = selectedId
    setSelectedId(undefined)
  }
  useEffect(() => {
    if (selectedId) back.current?.focus({ preventScroll: true })
    else if (returnTask.current) {
      root.current?.querySelector<HTMLButtonElement>(`[data-task-id="${returnTask.current}"]`)?.focus({ preventScroll: true })
      returnTask.current = undefined
    }
  }, [selectedId])
  return <div ref={root} className="flex min-w-0 flex-col gap-4" onKeyDown={event => {
    if (event.key === "Escape" && selected) { event.stopPropagation(); closeDetails() }
  }}>
    <header className="flex items-center gap-2 border-b pb-3">
      <span className="flex size-8 shrink-0 items-center justify-center">
        {selected ? <Button ref={back} variant="ghost" size="icon-sm" aria-label={t.boardBack} onClick={closeDetails}><ArrowLeft /></Button> : null}
      </span>
      <h2 className="text-base font-semibold">{t.analysisBoard}</h2>
    </header>
    <div className="report-preparation-layout" data-detail={Boolean(selected)}>
      <m.div key={stage ?? "overview"} className="report-preparation-columns" {...slidePresence(still, "x", -20, 0, "reveal")}>
        {REPORT_STAGES.filter(value => !selected || value === stage).map(value => <PreparationColumn key={value}
          stage={value} tasks={tasks.filter(task => analysisTaskStage(task) === value).toSorted((a, b) => a.taskId.localeCompare(b.taskId))}
          selectedId={selectedId} moving={running && !still} running={running} t={t}
          onSelect={setSelectedId} />)}
      </m.div>
        {selected && reportId ? <m.aside key="details" className="report-preparation-detail" aria-label={t.analysisContent}
          {...slidePresence(still, "x", 32, 0, "reveal")}>
          <m.div key={selected.taskId} {...fadePresence(still, "quick")}>
            <h3 className="border-b p-4 text-sm font-semibold">{analysisTaskLabel(selected, t)}</h3>
            <AnalysisTaskOutput reportId={reportId} task={selected} live={running} t={t} />
          </m.div>
          {analysisTaskStage(selected) === "analysis" ? <div className="p-4"><LiveSwotRadar reportId={reportId} tasks={tasks} t={t} /></div> : null}
        </m.aside> : null}
    </div>
  </div>
}
