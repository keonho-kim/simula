/**
 * Purpose: Prepare scenario, source-only material, and world evidence through independent frontiers.
 * Pattern: Bounded evidence preparation with explicit missing inputs.
 * Usage: Started concurrently by the analytical report graph.
 * Related: src/backend/core/simulation/outputs/analysis/summaries.ts, src/backend/core/simulation/outputs/analysis/contracts.ts
 */
import { mapGenerationTasks } from "@/backend/core/generation/tasks"
import type { AnalysisDependencies, AnalysisInput, AnalysisTasks, WorldSummary } from "./contracts"
import { analysisIdentity, textReferences, worldReferences } from "./evidence"
import { EMPTY_SUMMARY, reduceSummaries, summarizeReferences } from "./summaries"

export function prepareScenarioEvidence(tasks: AnalysisTasks, input: AnalysisInput, dependencies: AnalysisDependencies) {
  return summarizeReferences(tasks, dependencies, "scenario-context", textReferences(
    `scenario-${analysisIdentity(JSON.stringify(input.subject))}`, input.scenarioText, input.scenarioCategory))
}

export async function prepareMaterialEvidence(tasks: AnalysisTasks, input: AnalysisInput, dependencies: AnalysisDependencies, unavailable: string[]) {
  const documents = await mapGenerationTasks(input.documentIds, input.fastMode, async documentId => {
    try {
      const blocks = await dependencies.readDocument(documentId)
      if (blocks.some(block => block.documentId !== documentId)) throw new Error("Document scope mismatch.")
      return await summarizeReferences(tasks, dependencies, `document-${documentId}`, blocks.map(block => ({
        id: block.id, category: block.kind === "visual" ? "analytical_interpretation" : "source_claim", text: block.content,
        documentId, locator: block.locator, method: block.method, sourceKind: block.kind,
      })))
    } catch { dependencies.signal.throwIfAborted(); unavailable.push(`document-${documentId}`); return EMPTY_SUMMARY }
  })
  return reduceSummaries(tasks, "material-summary", documents, new Set(), "SOURCE")
}

export async function prepareWorldEvidence(tasks: AnalysisTasks, input: AnalysisInput, dependencies: AnalysisDependencies, unavailable: string[]): Promise<WorldSummary[]> {
  const summaries = await mapGenerationTasks(input.worlds.filter(world => world.status === "completed"), input.fastMode, async world => {
    try {
      if (!world.runId) throw new Error("Completed world has no run artifact.")
      const references = worldReferences(await dependencies.readWorld(world.runId), world.runId)
      const summary = await summarizeReferences(tasks, dependencies, `world-${analysisIdentity(world.id)}`, references)
      const observations = new Set(references.filter(reference => reference.category === "simulation_observation").map(reference => reference.id))
      return { world, summary, observationIds: summary.evidenceIds.filter(id => observations.has(id)) }
    } catch { dependencies.signal.throwIfAborted(); unavailable.push(`world-${world.id}`); return undefined }
  })
  return summaries.filter((value): value is WorldSummary => value !== undefined)
}
