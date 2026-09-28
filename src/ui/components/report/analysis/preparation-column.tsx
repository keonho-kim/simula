/**
 * Purpose: Show semantic report groups and their received-task progress within a kanban column.
 * Pattern: Presentational component.
 * Usage: Rendered by the preparation board overview before a group is selected.
 * Related: src/ui/models/report/preparation-groups.ts, src/ui/components/report/analysis/activity.tsx
 */
import * as m from "motion/react-m"
import { Button } from "@/ui/components/ui/button"
import { Progress } from "@/ui/components/ui/progress"
import { activeRowMotion } from "@/ui/animation/activity"
import { analysisLabel, type REPORT_STAGES } from "@/ui/models/report/analytical-view"
import type { PreparationGroup } from "@/ui/models/report/preparation-groups"
import { builderLabel } from "@/ui/models/scenario-builder/labels"
import type { UiTexts } from "@/ui/types/i18n"

export function PreparationColumn({ stage, groups, onSelect, moving, t }: {
  stage: typeof REPORT_STAGES[number]
  groups: PreparationGroup[]
  onSelect: (id: string) => void
  moving: boolean
  t: UiTexts
}) {
  const active = groups.find(group => group.status === "running" || group.status === "retrying")
  return <section className="report-preparation-column" aria-label={analysisLabel(stage, t)}>
    <h3 className="rounded-sm bg-muted/60 px-3 py-2 text-sm font-medium">{analysisLabel(stage, t)}</h3>
    <div className="flex flex-col gap-2">
      {groups.length ? groups.map(group => {
        const progress = t.analysisGroupProgress.replace("{completed}", String(group.completed)).replace("{total}", String(group.tasks.length))
        return <Button key={group.id} variant="outline" className="report-preparation-task"
          data-group-id={group.id} onClick={() => onSelect(group.id)}>
          {group.id === active?.id ? <m.span aria-hidden="true" className="report-preparation-highlight" {...activeRowMotion(moving)} /> : null}
          <span className="report-preparation-indicator mt-1" data-status={group.status} aria-hidden="true" />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span>{group.title}</span>
            <span className="text-xs text-muted-foreground">{builderLabel(group.status, t)}</span>
            <Progress value={group.completed / group.tasks.length * 100} aria-label={progress} />
            <span className="text-xs text-muted-foreground">{progress}</span>
          </span>
        </Button>
      }) : <p className="p-3 text-xs text-muted-foreground">{t.analysisPending}</p>}
    </div>
  </section>
}
