/**
 * Purpose: Navigate report groups, subtasks, and opt-in live details without duplicate overview cards.
 * Pattern: Scoped subscription and master-detail composition.
 * Usage: Mounted only by the report preparation page.
 * Related: src/ui/components/report/analysis/preparation-column.tsx, src/ui/components/report/analysis/task-output.tsx
 */
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft } from "lucide-react"
import * as m from "motion/react-m"
import { useGenerationStream } from "@/ui/hooks/use-generation-stream"
import { REPORT_STAGES } from "@/ui/models/report/analytical-view"
import { Button } from "@/ui/components/ui/button"
import type { UiTexts } from "@/ui/types/i18n"
import type { GenerationTaskView } from "@/ui/models/generation/progress"
import { useDocumentVisible } from "@/ui/animation/use-document-visible"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { fadePresence, slidePresence } from "@/ui/animation/presence"
import { AnalysisTaskOutput } from "./task-output"
import { groupPreparationTasks } from "@/ui/models/report/preparation-groups"
import { PreparationTaskList } from "./preparation-task-list"
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
  const [groupId, setGroupId] = useState<string>()
  const groups = useMemo(() => groupPreparationTasks(tasks, running, t), [tasks, running, t])
  const group = groups.find(value => value.id === groupId)
  const [selectedId, setSelectedId] = useState<string>()
  const root = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLButtonElement>(null)
  const returnTarget = useRef<{ kind: "task" | "group"; id: string } | undefined>(undefined)
  const visible = useDocumentVisible()
  const reduced = useReducedMotionPreference()
  const still = reduced || !visible
  const selected = group?.tasks.find(item => item.task.taskId === selectedId)
  const goBack = () => {
    if (selectedId) { returnTarget.current = { kind: "task", id: selectedId }; setSelectedId(undefined) }
    else if (groupId) { returnTarget.current = { kind: "group", id: groupId }; setGroupId(undefined) }
  }
  useEffect(() => {
    if (returnTarget.current) {
      const { kind, id } = returnTarget.current
      const target = root.current?.querySelector<HTMLButtonElement>(`[data-${kind}-id="${id}"]`) ?? back.current
      target?.focus({ preventScroll: true })
      returnTarget.current = undefined
    } else if (groupId) back.current?.focus({ preventScroll: true })
  }, [groupId, selectedId])
  return <div ref={root} className="flex min-w-0 flex-col gap-4" onKeyDown={event => {
    if (event.key === "Escape" && group) { event.stopPropagation(); goBack() }
  }}>
    <header className="flex items-center gap-2 border-b pb-3">
      <span className="flex size-8 shrink-0 items-center justify-center">
        {group ? <Button ref={back} variant="ghost" size="icon-sm" aria-label={selectedId ? t.analysisBackToGroup : t.boardBack} onClick={goBack}><ArrowLeft /></Button> : null}
      </span>
      <h2 className="text-base font-semibold">{group?.title ?? t.analysisBoard}</h2>
    </header>
    <p className="text-xs text-muted-foreground">{t.analysisTaskCoverage}</p>
    <div className="report-preparation-layout" data-detail={Boolean(group)}>
      <m.div key={group?.id ?? "overview"} className="report-preparation-columns" {...slidePresence(still, "x", -20, 0, "reveal")}>
        {group ? <PreparationTaskList group={group} selectedId={selectedId} running={running} moving={running && !still}
          onSelect={setSelectedId} t={t} /> : REPORT_STAGES.map(stage => <PreparationColumn key={stage} stage={stage}
          groups={groups.filter(value => value.stage === stage)} moving={running && !still} t={t}
          onSelect={id => { setGroupId(id); setSelectedId(undefined) }} />)}
      </m.div>
      {group ? <m.aside key="details" className="report-preparation-detail" aria-label={t.analysisContent}
        {...slidePresence(still, "x", 32, 0, "reveal")}>
        {selected && reportId ? <>
          <m.div key={selected.task.taskId} {...fadePresence(still, "quick")}>
            <header className="flex flex-col gap-1 border-b p-4"><p className="text-xs text-muted-foreground">{group.title}</p>
              <h3 className="text-sm font-semibold">{selected.subtitle}</h3></header>
            <AnalysisTaskOutput reportId={reportId} task={selected.task} live={running} t={t} />
          </m.div>
        </> : <p className="p-5 text-sm text-muted-foreground">{t.analysisSelectTask}</p>}
      </m.aside> : null}
    </div>
  </div>
}
