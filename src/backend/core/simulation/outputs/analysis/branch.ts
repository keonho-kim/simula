/**
 * Purpose: Generate one grounded development analysis section and its bounded final detail.
 * Pattern: Independently progressing branch graph.
 * Usage: Invoked by report orchestration once that branch's evidence is ready.
 * Related: src/backend/core/simulation/outputs/analysis/state.ts, src/shared/analytical-report-schema.ts
 */
import { detailInstructions } from "./prompts/detail"
import { END, START, StateGraph } from "@langchain/langgraph"
import { z } from "zod"
import type { AnalysisCoverage, AnalysisFinding, AnalysisPerspective, AnalysisSection, AnalysisSectionId, TrajectoryDistribution } from "@/shared/analytical-report"
import { analysisDetailSchema, analysisFindingsSchema } from "@/shared/analytical-report-schema"
import { AnalysisBranchState } from "./state"
import { buildSectionFindings } from "./findings"
import type { AnalysisDependencies, AnalysisTasks, EvidenceSummary } from "./contracts"


interface SectionInput { sources: EvidenceSummary; observations?: EvidenceSummary; providedDocuments?: number; unavailableInputs: string[]; coverage?: AnalysisCoverage; trajectories?: TrajectoryDistribution }
function summaryForPrompt(value: EvidenceSummary) { return { summary: value.summary, evidenceIds: value.evidenceIds } }

export async function generateAnalysisSection(tasks: AnalysisTasks, id: AnalysisSectionId, perspective: AnalysisPerspective, input: SectionInput,
  evidenceIds: string[], readReference: AnalysisDependencies["readReference"]): Promise<AnalysisSection> {
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
    .addNode("detail", async () => {
      const findings = await readGroundedFindings()
      const references = [...new Set([...findings.evidenceIds, ...findings.findings.flatMap(finding => finding.evidenceIds)])]
      await tasks.run({ id: `${id}-detail`, kind: "report-detail", schema: analysisDetailSchema, output: "text",
        parse: text => ({ summary: findings.summary, content: text.trim(), evidenceIds: references }),
        outputStyle: "detail", instruction: detailInstructions(id),
        shape: "3–6 connected paragraphs of explanatory prose for this section",
        input: { ANALYSIS: { perspective: perspectiveView, findings } }, evidenceIds: references,
      })
      return { detailRef: `${id}-detail` }
    })
    .addEdge(START, "findings").addEdge("findings", "detail").addEdge("detail", END)
  const result = await graph.compile().invoke({ sectionId: id, findingsRef: "", detailRef: "" }, { signal: tasks.dependencies.signal })
  const accepted = await readGroundedFindings()
  const detail = await tasks.read(result.detailRef, analysisDetailSchema)
  return { id, status: "ready", ...detail, findings: accepted.findings }
}

export function failedAnalysisSection(id: AnalysisSectionId): AnalysisSection {
  return { id, status: "failed", summary: "", content: "", findings: [], evidenceIds: [] }
}
