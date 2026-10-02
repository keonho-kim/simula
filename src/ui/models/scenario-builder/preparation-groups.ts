/**
 * Purpose: Project bounded builder work into stages, generation targets, and meaningful steps.
 * Pattern: Pure presentation projection.
 * Usage: Consumed by BuilderActivity for shared scenarios and individual world preparation.
 * Related: src/ui/models/scenario-builder/progress.ts, src/backend/core/scenario-builder/design.ts, src/backend/core/story-builder/world/nodes.ts
 */
import type { GenerationTaskView } from "@/ui/models/generation/progress"
import type { UiTexts } from "@/ui/types/i18n"
import { builderLabel } from "./labels"
import { BUILDER_STAGES, builderTaskStage } from "./progress"

export type BuilderChannel = "scenario-builder" | "worlds"
export interface BuilderStep { readonly task: GenerationTaskView; readonly title: string; readonly order: number }
export interface BuilderGroup {
  readonly id: string
  readonly stage: typeof BUILDER_STAGES[number]
  readonly title: string
  readonly steps: readonly BuilderStep[]
  readonly completed: number
  readonly status: GenerationTaskView["status"] | "canceled"
}

export function groupBuilderTasks(tasks: readonly GenerationTaskView[], { t, channel, terminal, documentNames }: {
  t: UiTexts; channel: BuilderChannel; terminal: boolean; documentNames?: ReadonlyMap<string, string>
}): BuilderGroup[] {
  const latest = new Map<string, GenerationTaskView>()
  for (const task of tasks) {
    if ((latest.get(task.taskId)?.attempt ?? 0) <= task.attempt) latest.set(task.taskId, task)
  }
  const groups = new Map<string, { id: string; title: string; order: number; stage: BuilderGroup["stage"]; steps: BuilderStep[] }>()
  for (const task of latest.values()) {
    const target = builderTarget(task, t, channel, documentNames)
    const stage = builderTaskStage(task.kind)
    const group = groups.get(target.id) ?? { ...target, stage, steps: [] }
    group.steps.push({ task, ...builderStepTitle(task, t, channel) })
    groups.set(group.id, group)
  }
  return [...groups.values()].sort((a, b) => BUILDER_STAGES.indexOf(a.stage) - BUILDER_STAGES.indexOf(b.stage)
    || a.order - b.order || a.id.localeCompare(b.id, "en", { numeric: true })).map(group => {
    const steps = group.steps.sort((a, b) => a.order - b.order || a.task.taskId.localeCompare(b.task.taskId, "en", { numeric: true }))
    const completed = steps.filter(step => step.task.status === "completed").length
    const status = steps.some(step => step.task.status === "failed") ? "failed"
      : terminal && completed !== steps.length ? "canceled"
        : steps.some(step => step.task.status === "retrying") ? "retrying"
          : steps.some(step => step.task.status === "running") ? "running"
            : steps.some(step => step.task.status === "waiting") ? "waiting"
              : terminal ? "completed" : "running"
    return { id: group.id, stage: group.stage, title: group.title, steps, completed, status }
  })
}

function builderTarget(task: GenerationTaskView, t: UiTexts, channel: BuilderChannel, documents?: ReadonlyMap<string, string>) {
  if (task.scope?.kind === "document") return { id: `document:${task.scope.id}`,
    title: documents?.get(task.scope.id) ?? t.builderEvidenceUnavailable,
    order: documents ? [...documents.keys()].indexOf(task.scope.id) : 0 }
  if (task.kind === "evidence" || task.kind === "digest") return { id: "sources:combined", title: t.builderSourceSynthesis, order: 1000 }
  if (task.kind === "situation") return { id: "situation:context", title: channel === "worlds" ? t.builderSetting : t.builderSituationTarget, order: 0 }
  if (task.scope?.kind === "facet") return { id: `facet:${task.scope.key}`, title: builderLabel(task.scope.key, t),
    order: ["goals", "constraints", "tensions"].indexOf(task.scope.key) + 1 }
  if (task.kind === "roster") return { id: "participants:roster", title: t.builderRoster, order: 0 }
  if (task.scope?.kind === "participant") return { id: `participant:${task.scope.name}`, title: task.scope.name,
    order: Number(task.taskId.match(/(?:^|-)participant-(\d+)/)?.[1] ?? 1) }
  return { id: task.kind, title: builderLabel(task.kind, t), order: task.kind === "rules" ? 0 : task.kind === "source-access" ? 1 : 2 }
}

function builderStepTitle(task: GenerationTaskView, t: UiTexts, channel: BuilderChannel): { title: string; order: number } {
  const id = task.taskId
  if (task.kind === "participant") {
    if (channel === "worlds") return id.endsWith("-summary") ? { title: t.builderStartingPosition, order: 0 }
      : { title: t.builderImmediateConcern, order: 1 }
    const field = ["personality", "authority", "goal"].find(key => id.endsWith(`-${key}`))
    if (field) return { title: builderLabel(field, t), order: ["personality", "authority", "goal"].indexOf(field) }
  }
  if (task.kind === "roster") {
    const index = id.match(/^roster-name-(\d+)$/)?.[1]
    return index ? { title: t.builderCastNameStep.replace("{index}", index), order: Number(index) }
      : { title: t.builderCastCountStep, order: 0 }
  }
  const evidence = /-(\d+)-(claim-(\d+)|summary|gap)$/.exec(id)
  if (task.kind === "evidence" && evidence) {
    const group = Number(evidence[1]) + 1
    const title = evidence[3] ? t.builderSourceClaimStep.replace("{index}", evidence[3])
      : evidence[2] === "summary" ? t.builderSourceSummaryStep : t.builderSourceGapStep
    return { title: title.replace("{group}", String(group)), order: group * 100 + (evidence[3] ? Number(evidence[3]) : evidence[2] === "summary" ? 50 : 60) }
  }
  const digest = /-digest-(\d+)-(\d+)-(select|summary)$/.exec(id)
  if (task.kind === "digest" && digest) return {
    title: (digest[3] === "select" ? t.builderDigestSelectStep : t.builderDigestSummaryStep)
      .replace("{level}", String(Number(digest[1]) + 1)).replace("{group}", String(Number(digest[2]) + 1)),
    order: 10_000 + Number(digest[1]) * 1000 + Number(digest[2]) * 2 + (digest[3] === "summary" ? 1 : 0),
  }
  if (task.kind === "situation") {
    const field = id.replace(/^(situation|opening)-/, "")
    const fields = channel === "worlds" ? ["setting", "summary", "assumption"] : ["title", "purpose", "decision", "setting"]
    if (fields.includes(field)) return { title: builderLabel(field === "assumption" ? "assumptions" : field, t), order: fields.indexOf(field) }
  }
  if (task.kind === "rules") return { title: task.scope?.kind === "rule" ? builderLabel(task.scope.key, t)
    : id === "agenda" ? t.builderAgenda : id === "information" ? t.builderInformation : t.builderRules,
    order: task.scope?.kind === "rule" ? ["information", "actions", "termination", "variation"].indexOf(task.scope.key) : id === "agenda" ? 0 : 1 }
  const fact = id.match(/^source-access-fact-(\d+)$/)?.[1]
  if (task.kind === "source-access" && fact) return { title: t.builderSourceAccessStep.replace("{index}", fact), order: Number(fact) }
  return { title: task.kind === "check" ? t.builderCheck : t.builderSummary, order: 0 }
}
