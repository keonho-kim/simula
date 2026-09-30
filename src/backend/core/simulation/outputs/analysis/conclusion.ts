/**
 * Purpose: Build a conclusion from separately grounded source, simulation, and implication paragraphs.
 * Pattern: Bounded synthesis use case with independent leaf tasks.
 * Usage: Called by the report graph after analytical branches finish.
 * Related: src/backend/core/simulation/outputs/analysis/graph.ts, src/backend/core/simulation/outputs/analysis/prompts/conclusion-paragraph.ts
 */
import { conclusionContext, conclusionPartContext, conclusionTrajectories } from "./conclusion-context"
import { conclusionParagraphInstructions } from "./prompts/conclusion-paragraph"
import { conclusionSummaryInstructions } from "./prompts/conclusion-summary"
import { conclusionInstructions as INSTRUCTIONS } from "./prompts/conclusion"
import type { PromptBlocks } from "@/backend/core/prompts/blocks"
import { analysisDetailSchema, MAX_ANALYSIS_REFERENCES } from "@/shared/analytical-report-schema"
import type { AnalysisCoverage, AnalysisPerspective, AnalysisSection, TrajectoryDistribution } from "@/shared/analytical-report"
import { mapGenerationTasks } from "@/backend/core/generation/tasks"
import type { AnalysisTasks, EvidenceSummary } from "./contracts"

const PART_CONTENT_CHARS = 3200
const SUMMARY_CONTEXT_CHARS = 350
const HEADINGS = {
  ko: ["자료의 의미와 판단 범위", "관찰된 전개와 결과의 차이", "종합 판단과 후속 확인"],
  en: ["Source evidence and the scope of judgment", "Observed developments and differing outcomes", "Integrated judgment and next checks"],
} as const
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
  const trajectorySummary = conclusionTrajectories(trajectories)
  const context = conclusionContext(input.perspective, input.sections, unavailableInputs)
  async function writePart(id: PartId, packet: PromptBlocks, evidenceIds: string[]) {
    const taskId = `conclusion-${id}`
    const references = [...new Set(evidenceIds)].slice(0, MAX_ANALYSIS_REFERENCES)
    const summary = await tasks.run({ id: `${taskId}-summary`, kind: "conclusion", schema: partSchema.shape.summary,
      output: "text", parse: (text: string) => text.trim(), instruction: conclusionSummaryInstructions(id),
      shape: "one concise summary sentence, ideally within 350 characters", input: packet, evidenceIds: references })
    const content = await tasks.run({ id: `${taskId}-content`, kind: "conclusion", schema: partSchema.shape.content,
      output: "text", outputStyle: "detail", parse: (text: string) => text.trim(),
      instruction: conclusionParagraphInstructions(id), shape: "2–3 substantive connected paragraphs, roughly 6–9 sentences, within 3,200 characters; shorter only when evidence is missing",
      input: { ...packet, PREVIOUS_RESULT: { summary: summary.slice(0, SUMMARY_CONTEXT_CHARS) } }, evidenceIds: references })
    const part = partSchema.parse({ summary, content, evidenceIds: references })
    await tasks.dependencies.saveTask({ id: taskId, fingerprint: JSON.stringify(part), value: part, attempt: 0 })
    return part
  }
  const [sourcePart, observedPart] = await mapGenerationTasks(["source", "observations"] as const, tasks.request.fastMode,
    id => id === "source"
      ? writePart(id, { SOURCE: { sourceMaterial: { kind: "document_evidence", ...source } }, ANALYSIS: { perspective: context.perspective } }, source.evidenceIds)
      : writePart(id, { SIMULATION: { simulatedWorlds: { kind: "simulation_evidence", ...observed }, trajectories: trajectorySummary }, INFO: { coverage }, ANALYSIS: { perspective: context.perspective } }, observed.evidenceIds))
  const evidenceIds = [...new Set([...source.evidenceIds, ...observed.evidenceIds, ...input.perspective.evidenceIds,
    ...input.sections.flatMap(section => section.evidenceIds)])]
  const implications = await writePart("implications", {
    SOURCE: { sourceAssessment: conclusionPartContext(sourcePart) },
    SIMULATION: { simulatedObservations: conclusionPartContext(observedPart), trajectories: trajectorySummary },
    INFO: { coverage }, ANALYSIS: context,
  }, evidenceIds)
  const parts = [sourcePart, observedPart, implications]
  return analysisDetailSchema.parse({ summary: implications.summary,
    content: parts.map((part, index) => `## ${HEADINGS[tasks.request.language][index]}\n\n${part.content}`).join("\n\n"), evidenceIds: [...new Set(parts.flatMap(part => part.evidenceIds))].slice(0, MAX_ANALYSIS_REFERENCES) })
}
