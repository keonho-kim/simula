/**
 * Purpose: Generate independent evidence-based analyses and assemble a bounded report without global branch barriers.
 * Pattern: Compact orchestration graph with independently progressing analytical subgraphs.
 * Usage: Called by analytical report runtime for a terminal run or world batch.
 * Related: src/backend/core/simulation/outputs/analysis/branch.ts, src/backend/core/simulation/outputs/analysis/conclusion.ts
 */
import { END, START, StateGraph } from "@langchain/langgraph"
import { ANALYSIS_SECTIONS, type AnalysisPerspective, type AnalysisSection, type AnalysisSectionId, type AnalyticalReport, type TrajectoryDistribution } from "@/shared/analytical-report"
import { analysisPerspectiveSchema } from "@/shared/analytical-report-schema"
import { createGenerationTasks } from "@/backend/core/generation/tasks"
import type { AnalysisDependencies, AnalysisInput } from "./contracts"
import { AnalysisState } from "./state"
import { failedAnalysisSection, generateAnalysisSection } from "./branch"
import { prepareMaterialEvidence, prepareScenarioEvidence, prepareWorldEvidence } from "./preparation"
import { EMPTY_SUMMARY, reduceSummaries } from "./summaries"
import type { EvidenceSummary } from "./contracts"
import { classifyTrajectories } from "./trajectories"
import { generateConclusion } from "./conclusion"
import { buildPerspective } from "./perspective"

export async function generateAnalyticalReport(reportId: string, input: AnalysisInput, dependencies: AnalysisDependencies): Promise<AnalyticalReport> {
  const controller = new AbortController()
  dependencies = { ...dependencies, signal: AbortSignal.any([dependencies.signal, controller.signal]) }
  const tasks = createGenerationTasks({ language: input.language, fastMode: input.fastMode }, dependencies)
  const unavailableInputs: string[] = []
  const materialWork = () => prepareMaterialEvidence(tasks, input, dependencies, unavailableInputs).catch(() => {
    dependencies.signal.throwIfAborted(); unavailableInputs.push("material-summary"); return EMPTY_SUMMARY
  })
  const worldWork = () => prepareWorldEvidence(tasks, input, dependencies, unavailableInputs)
  // Keep these independent promises observed from creation, including early errors.
  const materials = input.fastMode ? materialWork().then(value => ({ value }), error => ({ error })) : undefined
  const worlds = input.fastMode ? worldWork().then(value => ({ value }), error => ({ error })) : undefined
  let perspective: AnalysisPerspective | undefined
  let sections: AnalysisSection[] = []
  let trajectories: TrajectoryDistribution = { categories: [], unclassifiedWorldIds: [] }
  let sourceEvidence: EvidenceSummary = EMPTY_SUMMARY
  let simulatedEvidence: EvidenceSummary = EMPTY_SUMMARY
  const coverage = { requested: input.worlds.length, completed: input.worlds.filter(world => world.status === "completed").length,
    failed: input.worlds.filter(world => world.status === "failed").length, canceled: input.worlds.filter(world => world.status === "canceled").length,
    interrupted: input.worlds.filter(world => world.status === "interrupted").length, analyzed: 0 }
  const graph = new StateGraph(AnalysisState)
    .addNode("perspective", async () => {
      const scenario = await prepareScenarioEvidence(tasks, input, dependencies)
      const ref = await buildPerspective(tasks, scenario)
      perspective = await tasks.read(ref, analysisPerspectiveSchema)
      return { perspectiveRef: ref }
    })
    .addNode("analyses", async () => {
      const acceptedPerspective = await tasks.read("perspective", analysisPerspectiveSchema)
      const materialSummary = (materials ? materials.then(result => { if ("error" in result) throw result.error; return result.value }) : materialWork())
        .then(value => { sourceEvidence = value; return value })
      const worldSummaries = worlds ? worlds.then(result => { if ("error" in result) throw result.error; return result.value }) : Promise.resolve(await worldWork())
      const worldSummary = worldSummaries.then(async values => {
        coverage.analyzed = values.length
        simulatedEvidence = await reduceSummaries(tasks, "worlds-summary", values.map(value => ({ ...value.summary,
          summary: `World ${value.world.id}: ${value.summary.summary}` })), new Set(values.flatMap(value => value.observationIds)), "SIMULATION")
        return simulatedEvidence
      })
      const outcomes = Promise.all([worldSummary, materialSummary])
      const branch = async (id: Exclude<AnalysisSectionId, "conclusion">): Promise<AnalysisSection> => {
        try {
          if (id === "materials") {
            const source = await materialSummary
            return await generateAnalysisSection(tasks, id, acceptedPerspective, { sources: source, providedDocuments: input.documentIds.length, unavailableInputs }, source.evidenceIds, dependencies.readReference)
          }
          const [observed, source] = await outcomes
          const evidenceIds = [...new Set([...observed.evidenceIds, ...source.evidenceIds, ...acceptedPerspective.evidenceIds])]
          if (id === "trajectories") trajectories = await classifyTrajectories(tasks, await worldSummaries)
          return await generateAnalysisSection(tasks, id, acceptedPerspective,
            { observations: observed, sources: source, coverage, unavailableInputs: [...unavailableInputs], ...(id === "trajectories" ? { trajectories } : {}) }, evidenceIds, dependencies.readReference)
        } catch { dependencies.signal.throwIfAborted(); return failedAnalysisSection(id) }
      }
      const ids = ANALYSIS_SECTIONS.filter((id): id is Exclude<AnalysisSectionId, "conclusion"> => id !== "conclusion")
      if (input.fastMode) sections = await Promise.all(ids.map(branch))
      else for (const id of ids) sections.push(await branch(id))
      return { sectionRefs: sections.filter(section => section.status === "ready").map(section => `${section.id}-detail`) }
    })
    .addNode("conclusion", async () => {
      const acceptedPerspective = await tasks.read("perspective", analysisPerspectiveSchema)
      try {
        const conclusion = await generateConclusion(tasks, { perspective: acceptedPerspective, source: sourceEvidence,
          observed: simulatedEvidence, sections, coverage, trajectories, unavailableInputs })
        sections.push({ id: "conclusion", status: "ready", ...conclusion, findings: [] })
      } catch { dependencies.signal.throwIfAborted(); sections.push(failedAnalysisSection("conclusion")) }
      return {}
    }).addEdge(START, "perspective").addEdge("perspective", "analyses").addEdge("analyses", "conclusion").addEdge("conclusion", END)
  try { await graph.compile().invoke({ reportId, perspectiveRef: "", sectionRefs: [] }, { signal: dependencies.signal }) }
  catch (error) { controller.abort(error); throw error }
  finally { await Promise.allSettled([materials, worlds].filter(value => value !== undefined)) }
  dependencies.signal.throwIfAborted()
  if (!perspective) throw new Error("Report perspective could not be established.")
  return { perspective, coverage, trajectories, sections, unavailableInputs,
    evidenceIds: [...new Set([...perspective.evidenceIds, ...sections.flatMap(section => [...section.evidenceIds, ...section.findings.flatMap(finding => finding.evidenceIds), ...(section.score?.evidenceIds ?? [])])])] }
}
