/**
 * Purpose: Map analytical identities to reading stages, localized labels, and validated chart geometry.
 * Pattern: Pure presentation functions.
 * Usage: Used by report activity, board, and radar components.
 * Related: src/shared/analytical-report.ts, src/ui/i18n/messages/analytical-report.ts
 */
import { ANALYSIS_SECTIONS, type AnalysisSection } from "@/shared/analytical-report"
import type { GenerationTaskView } from "@/ui/models/generation/progress"
import type { UiTexts } from "@/ui/types/i18n"

export const REPORT_STAGES = ["evidence", "analysis", "synthesis"] as const
export const SWOT_SECTIONS = ["strengths", "weaknesses", "opportunities", "threats"] as const
export function analysisLabel(key: string, t: UiTexts): string {
  const labels: Record<string, string> = { evidence: t.analysisEvidenceStage, analysis: t.analysisFindingsStage, synthesis: t.analysisSynthesisStage,
    strengths: t.analysisStrengths, weaknesses: t.analysisWeaknesses, opportunities: t.analysisOpportunities, threats: t.analysisThreats,
    trajectories: t.analysisTrajectories, actors: t.analysisActors, materials: t.analysisMaterials, scenario: t.analysisScenario, conclusion: t.analysisConclusion,
    perspective: t.analysisPerspective, "report-evidence": t.analysisEvidenceStage, trajectory: t.analysisTrajectories, check: t.builderCheck,
    summary: t.builderSummary, content: t.analysisContent, findings: t.reportDetailedItems, rationale: t.analysisPerspective, categories: t.analysisTrajectories,
    focus: t.analysisPerspective, objective: t.builderPurpose, horizon: t.builderSetting, boundary: t.builderConstraints,
    source_claim: t.analysisSource, scenario_assumption: t.analysisAssumption, user_constraint: t.analysisConstraint,
    simulation_observation: t.analysisObservation, analytical_interpretation: t.analysisInterpretation }
  return labels[key] ?? t.analysisFindingsStage
}
export function analysisTaskLabel(task: GenerationTaskView, t: UiTexts): string {
  if (task.taskId.startsWith("conclusion-source")) return t.analysisMaterials
  if (task.taskId.startsWith("conclusion-observations")) return t.analysisObservation
  if (task.taskId.startsWith("conclusion-implications")) return t.analysisImplications
  const section = ANALYSIS_SECTIONS.find(id => task.taskId.startsWith(`${id}-`))
  return analysisLabel(section ?? task.kind, t)
}
export function analysisTaskStage(task: GenerationTaskView): typeof REPORT_STAGES[number] {
  if (task.kind === "report-detail" || task.kind === "conclusion" || task.taskId.startsWith("conclusion-")) return "synthesis"
  return task.kind === "report-evidence" || task.kind === "perspective" ? "evidence" : "analysis"
}
export function radarPoints(sections: readonly AnalysisSection[]): string | undefined {
  const values = SWOT_SECTIONS.map(id => sections.find(section => section.id === id && section.status === "ready")?.score?.value)
  if (values.some(value => value == null || !Number.isInteger(value) || value < 0 || value > 4)) return undefined
  return values.map((value, index) => {
    const angle = index * Math.PI / 2 - Math.PI / 2
    const radius = (value ?? 0) * 20
    return `${(120 + Math.cos(angle) * radius).toFixed(1)},${(120 + Math.sin(angle) * radius).toFixed(1)}`
  }).join(" ")
}
