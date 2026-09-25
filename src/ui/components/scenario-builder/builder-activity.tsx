/**
 * Purpose: Present generation stages and a selected task's bounded live content.
 * Pattern: Scoped rendering composition.
 * Usage: Displayed while a shared scenario is generating or being retried.
 * Related: src/ui/hooks/use-generation-stream.ts, src/ui/models/scenario-builder/progress.ts
 */
import { useMemo, useState } from "react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { useQuery } from "@tanstack/react-query"
import { useGenerationStream } from "@/ui/hooks/use-generation-stream"
import { fetchGenerationTask } from "@/ui/api-client/generation"
import { BUILDER_STAGES, builderTaskStage } from "@/ui/models/scenario-builder/progress"
import { projectGenerationFields } from "@/shared/generation-preview"
import { builderLabel } from "@/ui/models/scenario-builder/labels"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { fadePresence, slidePresence } from "@/ui/animation/presence"
import { scenarioSourceName } from "@/ui/models/scenario-builder/source-name"
import { Button } from "@/ui/components/ui/button"
import { Badge } from "@/ui/components/ui/badge"
import type { UiTexts } from "@/ui/types/i18n"
import type { DocumentSet } from "@/shared/documents"

export function BuilderActivity({ buildId, open, documents, t, channel = "scenario-builder" }: { buildId: string; open: boolean; documents?: DocumentSet; t: UiTexts; channel?: "scenario-builder" | "worlds" }) {
  const reducedMotion = useReducedMotionPreference()
  const [selected, setSelected] = useState<string>()
  const [stage, setStage] = useState<typeof BUILDER_STAGES[number]>()
  const progress = useGenerationStream(buildId, selected, open, channel)
  const documentNames = useMemo(() => new Map(documents?.documents.map(document => [document.id, scenarioSourceName(document.name, t)])), [documents, t])
  const latest = progress.tasks.at(-1)
  const currentStage = stage ?? (latest ? builderTaskStage(latest.kind) : channel === "worlds" ? "situation" : "sources")
  const tasks = progress.tasks.filter(task => builderTaskStage(task.kind) === currentStage)
  const selectedTask = progress.tasks.find(task => task.taskId === selected)
  const accepted = useQuery({ queryKey: ["builder-task", channel, buildId, selected, selectedTask?.attempt],
    queryFn: ({ signal }) => fetchGenerationTask(buildId, selected ?? "", signal, channel), enabled: open && !!selected && selectedTask?.status === "completed", retry: false,
  })
  const activeDraft = progress.draft
  const acceptedFields = useMemo(() => projectGenerationFields(accepted.data), [accepted.data])
  const fields = activeDraft && activeDraft.taskId === selected ? activeDraft.fields : acceptedFields
  return <section className="document-builder-activity" aria-label={t.builderStatusRunning}>
    <nav className="document-builder-timeline" aria-label={t.builderReviewStage}>
      {BUILDER_STAGES.filter(value => channel !== "worlds" || value !== "sources").map(value => <Button key={value} variant={value === currentStage ? "secondary" : "ghost"} aria-pressed={value === currentStage} onClick={() => setStage(value)}>{builderLabel(value, t)}</Button>)}
    </nav>
    <p className="text-sm text-muted-foreground" role="status">{progress.disconnected ? t.builderReconnecting : t.builderSelectTask}</p>
    <AnimatePresence mode="wait" initial={false}><m.div key={currentStage} className="document-builder-task-grid"
      {...slidePresence(reducedMotion, "x", 8, -8)}>
      <div className="document-builder-task-list">
        {tasks.map(task => <Button key={task.taskId} variant={selected === task.taskId ? "secondary" : "ghost"} className="document-builder-task" data-status={task.status} aria-pressed={selected === task.taskId}
          onClick={() => setSelected(task.taskId)}>
          <span className="document-builder-indicator" aria-hidden="true">{task.status === "completed" ? "✓" : ""}</span>
          <span className="flex min-w-0 flex-col gap-1"><span>{builderLabel(task.kind, t)}</span>
            {task.scope ? <span className="break-all text-xs text-muted-foreground">{task.scope.kind === "document" ? documentNames.get(task.scope.id)
              : task.scope.kind === "participant" ? task.scope.name : builderLabel(task.scope.key, t)}</span> : null}
          </span><span className="ml-auto text-xs">{builderLabel(task.status, t)}</span>
        </Button>)}
      </div>
      <div className="document-builder-task-detail" aria-label={t.builderSummary}>
        <AnimatePresence mode="wait" initial={false}><m.div key={selected ?? "none"} className="flex min-w-0 flex-col items-start gap-4"
          {...fadePresence(reducedMotion, "quick")}>
          {selectedTask ? <Badge variant="outline">{builderLabel(selectedTask.status, t)}</Badge> : null}
          {activeDraft && activeDraft.taskId === selected ? <p className="text-xs text-muted-foreground">{t.builderDraftNotice}</p> : null}
          {fields.length ? fields.map((field, index) => <div key={`${field.key}-${index}`} className="flex flex-col gap-1">
            <h3 className="text-xs font-medium text-muted-foreground">{builderLabel(field.key, t)}</h3><p className="whitespace-pre-wrap break-words text-sm leading-6">{field.text}</p>
          </div>) : <p className="text-sm text-muted-foreground">{t.builderNoPreview}</p>}
        </m.div></AnimatePresence>
      </div>
    </m.div></AnimatePresence>
  </section>
}
