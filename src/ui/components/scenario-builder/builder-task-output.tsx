/**
 * Purpose: Display only the selected builder step's live draft or accepted result.
 * Pattern: Scoped subscription and deferred artifact query.
 * Usage: Mounted in BuilderActivity after a target and step are selected.
 * Related: src/ui/hooks/use-generation-stream.ts, src/ui/api-client/generation.ts, src/ui/models/scenario-builder/preparation-groups.ts
 */
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useGenerationStream } from "@/ui/hooks/use-generation-stream"
import { fetchGenerationTask } from "@/ui/api-client/generation"
import { projectGenerationFields } from "@/shared/generation-preview"
import { builderLabel } from "@/ui/models/scenario-builder/labels"
import type { BuilderChannel } from "@/ui/models/scenario-builder/preparation-groups"
import type { GenerationTaskView } from "@/ui/models/generation/progress"
import type { UiTexts } from "@/ui/types/i18n"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"
import { Button } from "@/ui/components/ui/button"
import { Alert, AlertDescription } from "@/ui/components/ui/alert"

export function BuilderTaskOutput({ buildId, executionId, task, channel, open, live, t }: {
  buildId: string; executionId?: string; task: GenerationTaskView; channel: BuilderChannel; open: boolean; live: boolean; t: UiTexts
}) {
  const active = open && live && (task.status === "running" || task.status === "retrying")
  const stream = useGenerationStream(buildId, task.taskId, active, channel)
  const accepted = useQuery({ queryKey: ["builder-task", channel, buildId, executionId, task.taskId, task.attempt],
    queryFn: ({ signal }) => fetchGenerationTask(buildId, task.taskId, signal, channel),
    // Accepted artifacts are immutable within this execution and attempt.
    enabled: open && task.status === "completed", staleTime: Infinity, retry: false,
  })
  const storedFields = useMemo(() => projectGenerationFields(accepted.data), [accepted.data])
  const draft = active && stream.draft?.taskId === task.taskId && stream.draft.attempt >= task.attempt ? stream.draft : undefined
  const fields = draft?.fields ?? storedFields
  return <div className="builder-generation-fields">
    {task.status === "failed" ? <Alert variant="destructive"><AlertDescription>{t.builderRequestError}</AlertDescription></Alert> : null}
    {draft ? <p className="text-xs text-muted-foreground">{t.builderDraftNotice}</p> : null}
    {accepted.isError ? <Alert variant="destructive"><AlertDescription>{t.builderStepLoadFailed}</AlertDescription>
      <Button variant="outline" size="sm" onClick={() => void accepted.refetch()}>{t.builderRetry}</Button></Alert>
      : accepted.isFetching && !fields.length ? <p role="status">{t.builderStepLoading}</p>
        : fields.length ? fields.map((field, index) => <section key={`${field.key}-${index}`}>
          {field.key !== "content" ? <h4>{builderLabel(field.key, t)}</h4> : null}
          <MarkdownContent generated content={field.text} />
        </section>) : <p className="text-sm text-muted-foreground">{task.status === "completed" && accepted.isSuccess
          ? t.builderStepStructuredResult : t.builderStepPending}</p>}
  </div>
}
