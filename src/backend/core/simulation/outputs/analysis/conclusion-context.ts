/**
 * Purpose: Bound accepted conclusion inputs while preserving observations, disagreements, and detailed interpretations.
 * Pattern: Pure projection.
 * Usage: Used by final conclusion synthesis after its independent source and observation parts.
 * Related: src/backend/core/simulation/outputs/analysis/conclusion.ts
 */
import type { AnalysisPerspective, AnalysisSection, TrajectoryDistribution } from "@/shared/analytical-report"

const PERSPECTIVE_CHARS = 180
const SUMMARY_CHARS = 240
const FINDING_CHARS = 160
const DETAIL_CHARS = 360
const ACCEPTED_PART_CHARS = 400
const FINDINGS_PER_SECTION = 2
const MAX_MISSING_INPUTS = 4
const INPUT_ID_CHARS = 60
const PATH_DESCRIPTION_CHARS = 120

export function conclusionContext(perspective: AnalysisPerspective, sections: AnalysisSection[], unavailableInputs: string[]) {
  return { perspective: { focus: perspective.focus.slice(0, PERSPECTIVE_CHARS), objective: perspective.objective.slice(0, PERSPECTIVE_CHARS),
    horizon: perspective.horizon.slice(0, PERSPECTIVE_CHARS), boundary: perspective.boundary.slice(0, PERSPECTIVE_CHARS) },
    sections: sections.map(section => ({ id: section.id, status: section.status, kind: "analytical_interpretation",
      summary: section.summary.slice(0, SUMMARY_CHARS), detailExcerpt: section.content.slice(0, DETAIL_CHARS),
      findings: section.findings.slice(0, FINDINGS_PER_SECTION).map(finding => ({ text: finding.text.slice(0, FINDING_CHARS), provenance: finding.provenance ?? [] })),
    })), unavailableInputs: unavailableInputs.slice(0, MAX_MISSING_INPUTS).map(id => id.slice(0, INPUT_ID_CHARS)), unavailableInputCount: unavailableInputs.length,
    excerptsArePartial: true }
}
export function conclusionPartContext(part: { summary: string; content: string }) {
  return { summary: part.summary.slice(0, SUMMARY_CHARS), detailExcerpt: part.content.slice(0, ACCEPTED_PART_CHARS), excerptsArePartial: true }
}
export function conclusionTrajectories(trajectories: TrajectoryDistribution) {
  return { categories: trajectories.categories.map(category => ({ label: category.label, description: category.description.slice(0, PATH_DESCRIPTION_CHARS),
    observedWorldCount: category.worldIds.length })), unclassifiedWorldCount: trajectories.unclassifiedWorldIds.length, descriptionsArePartial: true }
}
