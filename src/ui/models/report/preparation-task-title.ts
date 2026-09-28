/**
 * Purpose: Translate report subtask identities into meaningful subtitles and causal display order.
 * Pattern: Pure presentation mapping.
 * Usage: Called when projecting report preparation groups.
 * Related: src/backend/core/simulation/outputs/analysis, src/ui/models/report/preparation-groups.ts
 */
import type { GenerationTaskView } from "@/ui/models/generation/progress"
import type { UiTexts } from "@/ui/types/i18n"

export function preparationTaskTitle(task: GenerationTaskView, t: UiTexts, sourceIndex?: number): { subtitle: string; order: number } {
  const id = task.taskId
  const perspective = ["focus", "objective", "horizon", "boundary"]
  const field = perspective.indexOf(id.replace(/^perspective-/, ""))
  if (task.kind === "perspective" && field >= 0) return { subtitle: [t.analysisFocusTask, t.analysisObjectiveTask, t.analysisHorizonTask, t.analysisBoundaryTask][field]!, order: field }
  const finding = /-finding-(\d+)-(source|text)$/.exec(id)
  if (finding) return { subtitle: (finding[2] === "source" ? t.analysisFindingSourceTask : t.analysisFindingTextTask).replace("{index}", finding[1]!), order: 10 + Number(finding[1]) * 2 + (finding[2] === "text" ? 1 : 0) }
  if (id.endsWith("-finding-count")) return { subtitle: t.analysisFindingCountTask, order: 1 }
  if (id.endsWith("-finding-gap")) return { subtitle: t.analysisGapTask, order: 30 }
  if (id.endsWith("-score")) return { subtitle: t.analysisScoreTask, order: 40 }
  if (id.endsWith("-summary")) return { subtitle: t.analysisSummaryTask, order: 0 }
  if (id.endsWith("-detail") || id.endsWith("-content")) return { subtitle: t.analysisDetailTask, order: 50 }
  const sourceLabel = id.startsWith("scenario-") ? t.analysisScenarioSourceTask : id.startsWith("document-") || id.startsWith("material-") ? t.analysisMaterialSourceTask : t.analysisWorldSourceTask
  const source = sourceIndex ? t.analysisNumberedSource.replace("{source}", sourceLabel).replace("{index}", String(sourceIndex)) : sourceLabel
  const leaf = /-evidence-(\d+)$/.exec(id)
  if (leaf) return { subtitle: t.analysisEvidencePartTask.replace("{source}", source).replace("{index}", String(Number(leaf[1]) + 1)), order: Number(leaf[1]) }
  const merge = /-summary-(\d+)-(\d+)$/.exec(id)
  if (merge) return { subtitle: t.analysisMergeTask.replace("{source}", source).replace("{level}", String(Number(merge[1]) + 1)).replace("{index}", String(Number(merge[2]) + 1)), order: 100 + Number(merge[1]) * 100 + Number(merge[2]) }
  if (task.kind === "trajectory") {
    if (id.startsWith("trajectory-world-")) return { subtitle: t.analysisClassifyWorldTask.replace("{index}", String(sourceIndex ?? 1)), order: 200 }
    const proposal = /^trajectory-proposal-(\d+)-/.exec(id)
    const vocabulary = /^trajectory-vocabulary-(\d+)-(\d+)-/.exec(id)
    const scope = proposal ? t.analysisTrajectoryProposalTask.replace("{index}", String(Number(proposal[1]) + 1))
      : vocabulary ? t.analysisTrajectoryMergeTask.replace("{level}", String(Number(vocabulary[1]) + 1)).replace("{index}", String(Number(vocabulary[2]) + 1)) : undefined
    const scoped = (title: string) => scope ? t.analysisScopedTask.replace("{scope}", scope).replace("{task}", title) : title
    const entry = /-(label|description)-(\d+)$/.exec(id)
    if (entry) return { subtitle: scoped((entry[1] === "label" ? t.analysisTrajectoryNameTask : t.analysisTrajectoryDescriptionTask).replace("{index}", entry[2]!)), order: 10 + Number(entry[2]) * 2 + (entry[1] === "description" ? 1 : 0) }
    if (id.endsWith("-count")) return { subtitle: scoped(t.analysisTrajectoryCountTask), order: 0 }
  }
  return { subtitle: task.kind === "check" ? t.builderCheck : t.analysisContent, order: 1000 }
}
