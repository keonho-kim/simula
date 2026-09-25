/**
 * Purpose: Render one visible live task with bounded follow scrolling and accepted-result replacement.
 * Pattern: Scoped subscription and deferred accepted-artifact query.
 * Usage: Mounted only for the report's visible task columns.
 * Related: src/ui/hooks/use-generation-stream.ts, src/ui/api-client/generation.ts
 */
import { useEffect, useMemo, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchGenerationTask } from "@/ui/api-client/generation"
import { useGenerationStream } from "@/ui/hooks/use-generation-stream"
import { projectGenerationFields } from "@/shared/generation-preview"
import type { GenerationTaskView } from "@/ui/models/generation/progress"
import type { UiTexts } from "@/ui/types/i18n"
import { analysisLabel } from "@/ui/models/report/analytical-view"

const FOLLOW_THRESHOLD_PX = 24
export function AnalysisTaskOutput({ reportId, task, t }: { reportId: string; task: GenerationTaskView; t: UiTexts }) {
  const active = task.status === "running" || task.status === "waiting" || task.status === "retrying"
  const stream = useGenerationStream(reportId, task.taskId, active, "analysis")
  const accepted = useQuery({ queryKey: ["generation-task", "analysis", reportId, task.taskId, task.attempt], enabled: task.status === "completed", retry: false,
    queryFn: ({ signal }) => fetchGenerationTask(reportId, task.taskId, signal, "analysis") })
  const storedFields = useMemo(() => projectGenerationFields(accepted.data), [accepted.data])
  const fields = active && stream.draft?.taskId === task.taskId ? stream.draft.fields : storedFields
  const viewport = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  useEffect(() => { if (following.current && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight }, [fields])
  return <div ref={viewport} className="report-task-output" onScroll={event => {
    const element = event.currentTarget
    following.current = element.scrollHeight - element.clientHeight - element.scrollTop <= FOLLOW_THRESHOLD_PX
  }}>
    {active ? <p className="text-xs text-muted-foreground">{t.builderDraftNotice}</p> : null}
    {accepted.isError ? <p role="alert">{t.reportLoadError}</p> : null}
    {fields.length ? fields.map((field, index) => <section key={`${field.key}-${index}`} className="flex flex-col gap-1"><h4 className="text-xs text-muted-foreground">{analysisLabel(field.key, t)}</h4><p className="whitespace-pre-wrap break-words text-sm leading-6">{field.text}</p></section>) : <p className="text-xs text-muted-foreground">{t.builderNoPreview}</p>}
  </div>
}
