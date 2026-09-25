/**
 * Purpose: Generate one analytical section, optional rubric score, and bounded final detail.
 * Pattern: Independently progressing branch graph.
 * Usage: Invoked by report orchestration once that branch's evidence is ready.
 * Related: src/backend/core/simulation/outputs/analysis/state.ts, src/shared/analytical-report-schema.ts
 */
import { scoreInstructions } from "./prompts/score"
import { detailInstructions } from "./prompts/detail"
import { END, START, StateGraph } from "@langchain/langgraph"
import { z } from "zod"
import type { AnalysisCoverage, AnalysisFinding, AnalysisPerspective, AnalysisSection, AnalysisSectionId, TrajectoryDistribution } from "@/shared/analytical-report"
import { analysisDetailSchema, analysisFindingsSchema, analysisScoreSchema, MAX_ANALYSIS_REFERENCES } from "@/shared/analytical-report-schema"
import { AnalysisBranchState } from "./state"
import { buildSectionFindings } from "./findings"
import type { AnalysisDependencies, AnalysisTasks, EvidenceSummary } from "./contracts"
const SWOT = new Set<AnalysisSectionId>(["strengths", "weaknesses", "opportunities", "threats"])


interface SectionInput { sources: EvidenceSummary; observations?: EvidenceSummary; providedDocuments?: number; unavailableInputs: string[]; coverage?: AnalysisCoverage; trajectories?: TrajectoryDistribution }
function summaryForPrompt(value: EvidenceSummary) { return { summary: value.summary, evidenceIds: value.evidenceIds } }

export async function generateAnalysisSection(tasks: AnalysisTasks, id: AnalysisSectionId, perspective: AnalysisPerspective, input: SectionInput,
  evidenceIds: string[], readReference: AnalysisDependencies["readReference"]): Promise<AnalysisSection> {
  const score = SWOT.has(id)
  const perspectiveView = { focus: perspective.focus, objective: perspective.objective,
    horizon: perspective.horizon, boundary: perspective.boundary }
  const packet = { SOURCE: { sources: summaryForPrompt(input.sources) },
    SIMULATION: { observations: input.observations ? summaryForPrompt(input.observations) : undefined, trajectories: input.trajectories },
    ANALYSIS: { perspective }, INFO: { coverage: input.coverage, providedDocuments: input.providedDocuments, unavailableInputs: input.unavailableInputs } }
  const findingsId = `${id}-findings`
  let groundedFindings: Promise<z.infer<typeof analysisFindingsSchema> & { findings: AnalysisFinding[] }> | undefined
  function readGroundedFindings() {
    return groundedFindings ??= tasks.read(findingsId, analysisFindingsSchema).then(async value => ({ ...value,
      findings: await Promise.all(value.findings.map(async finding => {
        const categories = await Promise.all(finding.evidenceIds.map(async evidenceId => {
          const reference = await readReference(evidenceId)
          if (!reference || reference.id !== evidenceId) throw new Error(`Report finding reference ${evidenceId} is unavailable.`)
          return reference.category
        }))
        return { ...finding, provenance: [...new Set(categories)] }
      })),
    }))
  }
  async function findings() {
    return buildSectionFindings(tasks, id, perspective, packet, evidenceIds, readReference)
  }
  const graph = new StateGraph(AnalysisBranchState)
    .addNode("findings", async () => { await findings(); return { findingsRef: findingsId } })
    .addNode("score", async () => {
      const value = await readGroundedFindings()
      const idRef = `${id}-score`
      const references = [...new Set(value.findings.flatMap(finding => finding.evidenceIds))].slice(0, MAX_ANALYSIS_REFERENCES)
      if (!value.findings.length) {
        const empty = analysisScoreSchema.parse({ value: null, rationale: value.summary, evidenceIds: [] })
        await tasks.dependencies.saveTask({ id: idRef, fingerprint: JSON.stringify(empty), value: empty, attempt: 0 })
      } else await tasks.run({ id: idRef, kind: "swot", schema: analysisScoreSchema,
        output: "choice", parse: (text: string) => {
          const selected = text.trim()
          if (!/^[0-4?]$/.test(selected)) throw new Error("Choose exactly one supplied SWOT score or ?.")
          return { value: selected === "?" ? null : Number(selected), rationale: value.summary, evidenceIds: references }
        },
        instruction: scoreInstructions,
        shape: "one of 0, 1, 2, 3, 4, or ? for unknown",
        input: { ANALYSIS: { perspective: perspectiveView, branch: id, findings: value } }, evidenceIds: references,
      })
      return { scoreRef: idRef }
    })
    .addNode("detail", async state => {
      const findings = await readGroundedFindings()
      const assessment = state.scoreRef ? await tasks.read(state.scoreRef, analysisScoreSchema) : undefined
      const references = [...new Set([...findings.evidenceIds, ...findings.findings.flatMap(finding => finding.evidenceIds), ...(assessment?.evidenceIds ?? [])])]
      await tasks.run({ id: `${id}-detail`, kind: "report-detail", schema: analysisDetailSchema, output: "text",
        parse: text => ({ summary: findings.summary, content: text.trim(), evidenceIds: references }),
        outputStyle: "detail",
        instruction: detailInstructions(id),
        shape: "3–6 connected paragraphs of explanatory prose for this section",
        input: { ANALYSIS: { perspective: perspectiveView, findings, assessment } }, evidenceIds: references,
      })
      return { detailRef: `${id}-detail` }
    })
    .addEdge(START, "findings").addConditionalEdges("findings", () => score ? "score" : "detail", ["score", "detail"])
    .addEdge("score", "detail").addEdge("detail", END)
  const result = await graph.compile().invoke({ sectionId: id, findingsRef: "", scoreRef: "", detailRef: "" }, { signal: tasks.dependencies.signal })
  const accepted = await readGroundedFindings()
  const detail = await tasks.read(result.detailRef, analysisDetailSchema)
  const assessment = result.scoreRef ? await tasks.read(result.scoreRef, analysisScoreSchema) : undefined
  if (assessment?.value !== null && assessment && !accepted.findings.length) throw new Error("A SWOT score cannot be inferred without findings.")
  return { id, status: "ready", ...detail, findings: accepted.findings, score: assessment }
}

export function failedAnalysisSection(id: AnalysisSectionId): AnalysisSection {
  return { id, status: "failed", summary: "", content: "", findings: [], evidenceIds: [] }
}
