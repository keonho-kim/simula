/**
 * Purpose: List a selected report group's subtasks without automatically opening a text stream.
 * Pattern: Presentational component.
 * Usage: Rendered by the report preparation board after opening a group.
 * Related: src/ui/models/report/preparation-groups.ts, src/ui/components/report/analysis/activity.tsx
 */
import * as m from "motion/react-m"
import { Button } from "@/ui/components/ui/button"
import { activeRowMotion } from "@/ui/animation/activity"
import type { PreparationGroup } from "@/ui/models/report/preparation-groups"
import { builderLabel } from "@/ui/models/scenario-builder/labels"
import type { UiTexts } from "@/ui/types/i18n"

export function PreparationTaskList({ group, selectedId, onSelect, moving, running, t }: {
  group: PreparationGroup; selectedId?: string; onSelect: (id: string) => void; moving: boolean; running: boolean; t: UiTexts
}) {
  const active = group.tasks.find(({ task }) => task.status === "running" || task.status === "retrying")
  return <section className="report-preparation-column" aria-label={group.title}>
    <h3 className="rounded-sm bg-muted/60 px-3 py-2 text-sm font-medium">{group.title}</h3>
    {group.tasks.map(({ task, subtitle }, index) => {
      const status = !running && (task.status === "running" || task.status === "retrying") ? "canceled" : task.status
      return <Button key={task.taskId} variant="outline" className="report-preparation-task"
        data-task-id={task.taskId} aria-pressed={selectedId === task.taskId}
        disabled={task.status === "waiting"} onClick={() => onSelect(task.taskId)}>
        {running && task.taskId === active?.task.taskId ? <m.span aria-hidden="true" className="report-preparation-highlight" {...activeRowMotion(moving)} /> : null}
        <span className="report-preparation-marker" data-status={status} aria-hidden="true">
          {status === "completed" ? "✓" : status === "failed" ? "!" : status === "running" || status === "retrying" ? "▸" : "·"}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t.analysisTaskNumber.replace("{index}", String(index + 1))}</span>
          <span>{subtitle}</span>
          <span className="text-xs text-muted-foreground">{builderLabel(status, t)}</span>
        </span>
      </Button>
    })}
  </section>
}
