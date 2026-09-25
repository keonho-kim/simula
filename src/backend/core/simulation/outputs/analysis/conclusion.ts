/**
 * Purpose: Build a conclusion from separately grounded source, simulation, and implication paragraphs.
 * Pattern: Bounded synthesis use case with independent leaf tasks.
 * Usage: Called by the report graph after analytical branches finish.
 * Related: src/backend/core/simulation/outputs/analysis/graph.ts, src/backend/core/simulation/outputs/analysis/prompts/conclusion-paragraph.ts
 */
import { conclusionParagraphInstructions } from "./prompts/conclusion-paragraph"
import { conclusionSummaryInstructions } from "./prompts/conclusion-summary"
import { conclusionInstructions as INSTRUCTIONS } from "./prompts/conclusion"
import type { PromptBlocks } from "@/backend/core/prompts/blocks"
import { analysisDetailSchema, MAX_ANALYSIS_REFERENCES } from "@/shared/analytical-report-schema"
import type { AnalysisCoverage, AnalysisPerspective, AnalysisSection, TrajectoryDistribution } from "@/shared/analytical-report"
import { mapGenerationTasks } from "@/backend/core/generation/tasks"
import type { AnalysisTasks, EvidenceSummary } from "./contracts"

const PART_CONTENT_CHARS = 1800
const partSchema = analysisDetailSchema.extend({
  content: analysisDetailSchema.shape.content.max(PART_CONTENT_CHARS),
})

type PartId = keyof typeof INSTRUCTIONS

interface ConclusionInput {
  perspective: AnalysisPerspective
  source: EvidenceSummary
  observed: EvidenceSummary
  sections: AnalysisSection[]
  coverage: AnalysisCoverage
  trajectories: TrajectoryDistribution
  unavailableInputs: string[]
}

export async function generateConclusion(tasks: AnalysisTasks, input: ConclusionInput) {
  const { source, observed, coverage, trajectories, unavailableInputs } = input
  const perspective = { focus: input.perspective.focus, objective: input.perspective.objective,
    horizon: input.perspective.horizon, boundary: input.perspective.boundary }
  async function writePart(id: PartId, packet: PromptBlocks, evidenceIds: string[]) {
    const taskId = `conclusion-${id}`
    const references = [...new Set(evidenceIds)].slice(0, MAX_ANALYSIS_REFERENCES)
    const summary = await tasks.run({ id: `${taskId}-summary`, kind: "conclusion", schema: partSchema.shape.summary,
      output: "text", parse: (text: string) => text.trim(), instruction: conclusionSummaryInstructions(id),
      shape: "one concise summary sentence, ideally within 350 characters", input: packet, evidenceIds: references })
    const content = await tasks.run({ id: `${taskId}-content`, kind: "conclusion", schema: partSchema.shape.content,
      output: "text", outputStyle: "detail", parse: (text: string) => text.trim(),
      instruction: conclusionParagraphInstructions(id), shape: "one connected paragraph within 1,800 characters",
      input: { ...packet, PREVIOUS_RESULT: { summary } }, evidenceIds: references })
    const part = partSchema.parse({ summary, content, evidenceIds: references })
    await tasks.dependencies.saveTask({ id: taskId, fingerprint: JSON.stringify(part), value: part, attempt: 0 })
    return part
  }
  const [sourcePart, observedPart] = await mapGenerationTasks(["source", "observations"] as const, tasks.request.fastMode,
    id => id === "source"
      ? writePart(id, { SOURCE: { sourceMaterial: { kind: "document_evidence", ...source } } }, source.evidenceIds)
      : writePart(id, { SIMULATION: { simulatedWorlds: { kind: "simulation_evidence", ...observed }, trajectories }, INFO: { coverage } }, observed.evidenceIds))
  const evidenceIds = [...new Set([...source.evidenceIds, ...observed.evidenceIds, ...input.perspective.evidenceIds,
    ...input.sections.flatMap(section => section.evidenceIds)])]
  const implications = await writePart("implications", {
    SOURCE: { sourceAssessment: sourcePart }, SIMULATION: { simulatedObservations: observedPart, trajectories },
    INFO: { coverage, unavailableInputs }, ANALYSIS: { perspective, sections: input.sections.map(section => ({ id: section.id, status: section.status, kind: "analytical_interpretation",
      summary: section.summary.slice(0, 240), findings: section.findings.slice(0, 2).map(finding => ({
        text: finding.text.slice(0, 180), provenance: finding.provenance ?? [],
      })) })) },
  }, evidenceIds)
  const parts = [sourcePart, observedPart, implications]
  return analysisDetailSchema.parse({ summary: implications.summary,
    content: parts.map(part => part.content).join("\n\n"), evidenceIds: [...new Set(parts.flatMap(part => part.evidenceIds))].slice(0, MAX_ANALYSIS_REFERENCES) })
}
