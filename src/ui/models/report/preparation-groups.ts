/**
 * Purpose: Group report work by semantic responsibility and distinguish each generated subtask.
 * Pattern: Pure presentation projection.
 * Usage: Consumed by the report preparation board and its group/task lists.
 * Related: src/ui/models/report/analytical-view.ts, src/ui/models/report/preparation-task-title.ts
 */
import { ANALYSIS_SECTIONS } from "@/shared/analytical-report"
import type { GenerationTaskView } from "@/ui/models/generation/progress"
import type { UiTexts } from "@/ui/types/i18n"
import { analysisLabel, analysisTaskLabel, analysisTaskStage, REPORT_STAGES } from "./analytical-view"
import { preparationTaskTitle } from "./preparation-task-title"

export interface PreparationTask {
  task: GenerationTaskView
  subtitle: string
  order: number
}
export interface PreparationGroup {
  id: string
  stage: typeof REPORT_STAGES[number]
  title: string
  tasks: PreparationTask[]
  completed: number
  status: GenerationTaskView["status"] | "canceled"
}

export function groupPreparationTasks(tasks: GenerationTaskView[], running: boolean, t: UiTexts): PreparationGroup[] {
  const latest = new Map<string, GenerationTaskView>()
  for (const task of tasks) {
    if ((latest.get(task.taskId)?.attempt ?? 0) <= task.attempt) latest.set(task.taskId, task)
  }
  const grouped = new Map<string, PreparationGroup>()
  const sorted = [...latest.values()].sort((a, b) => a.taskId.localeCompare(b.taskId, "en", { numeric: true }))
  const sourceIndices = new Map<string, number>()
  const sourceCounts = new Map<string, number>()
  for (const task of sorted) {
    const stage = analysisTaskStage(task)
    const domain = task.kind === "report-evidence" ? "evidence" : task.kind === "perspective" ? "perspective"
      : task.taskId.match(/^conclusion-(source|observations|implications)/)?.[0]
      ?? ANALYSIS_SECTIONS.find(id => task.taskId.startsWith(`${id}-`))
      ?? (task.kind === "trajectory" ? "trajectories" : task.kind)
    const id = `${stage}:${domain}`
    const group = grouped.get(id) ?? { id, stage, title: domain === "evidence" ? analysisLabel("evidence", t) : analysisTaskLabel(task, t), tasks: [], completed: 0, status: "waiting" }
    const source = task.kind === "report-evidence" ? task.taskId.replace(/-(?:evidence-\d+|summary-\d+-\d+)$/, "")
      : task.taskId.startsWith("trajectory-world-") ? task.taskId : undefined
    const family = source?.match(/^(document|world|trajectory-world)-/)?.[1]
    if (family && source && !sourceIndices.has(source)) {
      const index = (sourceCounts.get(family) ?? 0) + 1
      sourceCounts.set(family, index)
      sourceIndices.set(source, index)
    }
    group.tasks.push({ task, ...preparationTaskTitle(task, t, source ? sourceIndices.get(source) : undefined) })
    grouped.set(id, group)
  }
  return [...grouped.values()].map(group => {
    group.tasks.sort((a, b) => a.order - b.order || a.task.taskId.localeCompare(b.task.taskId, "en", { numeric: true }))
    group.completed = group.tasks.filter(item => item.task.status === "completed").length
    const active = group.tasks.some(item => item.task.status === "running" || item.task.status === "retrying")
    group.status = active ? running ? group.tasks.some(item => item.task.status === "retrying") ? "retrying" : "running" : "canceled"
      : group.tasks.some(item => item.task.status === "failed") ? "failed"
        : group.completed === group.tasks.length ? "completed" : "waiting"
    return group
  }).sort((a, b) => REPORT_STAGES.indexOf(a.stage) - REPORT_STAGES.indexOf(b.stage) || a.id.localeCompare(b.id))
}
