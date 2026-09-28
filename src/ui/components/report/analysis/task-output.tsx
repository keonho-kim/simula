/**
 * Purpose: Render the selected report task's stream and replace it with accepted content.
 * Pattern: Scoped subscription and deferred accepted-artifact query.
 * Usage: Mounted only for the report preparation page's selected task.
 * Related: src/ui/hooks/use-generation-stream.ts, src/ui/api-client/generation.ts
 */
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchGenerationTask } from "@/ui/api-client/generation"
import { useGenerationStream } from "@/ui/hooks/use-generation-stream"
import { projectGenerationFields } from "@/shared/generation-preview"
import type { GenerationTaskView } from "@/ui/models/generation/progress"
import type { UiTexts } from "@/ui/types/i18n"
import { analysisLabel } from "@/ui/models/report/analytical-view"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"

export function AnalysisTaskOutput({ reportId, task, t }: { reportId: string; task: GenerationTaskView; t: UiTexts }) {
  const active = task.status === "running" || task.status === "waiting" || task.status === "retrying"
  const stream = useGenerationStream(reportId, task.taskId, active, "analysis")
  const accepted = useQuery({ queryKey: ["generation-task", "analysis", reportId, task.taskId, task.attempt], enabled: task.status === "completed", retry: false,
    queryFn: ({ signal }) => fetchGenerationTask(reportId, task.taskId, signal, "analysis") })
  const storedFields = useMemo(() => projectGenerationFields(accepted.data), [accepted.data])
  const fields = active && stream.draft?.taskId === task.taskId ? stream.draft.fields : storedFields
  return <div className="report-task-output">
    {active ? <p className="text-xs text-muted-foreground">{t.builderDraftNotice}</p> : null}
    {accepted.isError ? <p role="alert">{t.reportLoadError}</p> : null}
    {fields.length ? fields.map((field, index) => <section key={`${field.key}-${index}`} className="flex flex-col gap-1"><h4 className="text-xs text-muted-foreground">{analysisLabel(field.key, t)}</h4><MarkdownContent generated content={field.text} /></section>) : <p className="text-xs text-muted-foreground">{t.builderNoPreview}</p>}
  </div>
}
