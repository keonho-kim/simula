/**
 * Purpose: Read scoped preparation, world, and report usage for one accepted analysis.
 * Pattern: Read-only resource projection.
 * Usage: Called by analytical export and the read-only accounting endpoint.
 * Related: src/backend/runtime/analysis/jobs.ts, src/backend/core/simulation/outputs/analysis/accounting.ts
 */
import { DocumentError } from "@/backend/core/documents/validation"
import type { AnalysisSubject, ResourceAccounting, ResourceUsage, UsageMeasure } from "@/shared/analytical-report"
import type { DocumentRecord } from "@/shared/documents"
import { combineUsage, summarizeUsage } from "@/backend/core/simulation/outputs/analysis/accounting"
import { isMissingFileError } from "@/backend/storage/file-errors"
import type { AnalysisSources } from "./sources"
import { z } from "zod"

const ACCOUNTING_READ_CONCURRENCY = 8
type WorldRef = { id: string; runId?: string }
type WorldUsage = ResourceAccounting["worlds"][number]

export async function readResourceAccounting(subject: AnalysisSubject, sources: AnalysisSources,
  reportCalls: readonly UsageMeasure[], reportFailures: number | null): Promise<ResourceAccounting> {
  let scenarioId: string | undefined
  let worldRefs: WorldRef[] = []
  let worldsUnavailable = false
  try {
    if (subject.kind === "batch") {
      const batch = await sources.batches.read(subject.id)
      scenarioId = batch.request.scenarioId
      worldRefs = batch.worlds.map(world => ({ id: world.id, runId: world.runId }))
    } else {
      const run = await sources.runs.readManifest(subject.id)
      scenarioId = (await sources.runs.readScenario(run.id)).world?.sourceScenarioId
      worldRefs = [{ id: run.id, runId: run.id }]
    }
  } catch (error) {
    if (!isMissingFileError(error)) throw error
    worldsUnavailable = true
  }
  let sharedVersion: number | undefined
  let documentUsage: ResourceUsage | undefined
  if (scenarioId) {
    try {
      const scenario = await sources.scenarios.read(scenarioId)
      sharedVersion = scenario.usageAccountingVersion
      documentUsage = await readDocumentUsage(scenario.request.documentSetId, scenario.request.documentRevision, sources)
    }
    catch (error) { if (!isMissingFileError(error)) throw error }
  }
  const sharedCalls = scenarioId ? await sources.scenarios.readMetrics(scenarioId) : undefined
  const sharedFailures = scenarioId && sharedVersion === 1 ? (await sources.scenarios.readFailures(scenarioId))?.length ?? null : null
  const sharedPreparation = scenarioId ? combineUsage([
    summarizeUsage(sharedCalls?.map(call => call.metrics), sharedFailures), documentUsage ?? summarizeUsage(undefined),
  ])
    : worldsUnavailable ? summarizeUsage(undefined) : null
  const worlds: WorldUsage[] = []
  for (let offset = 0; offset < worldRefs.length; offset += ACCOUNTING_READ_CONCURRENCY) {
    worlds.push(...await Promise.all(worldRefs.slice(offset, offset + ACCOUNTING_READ_CONCURRENCY)
      .map(world => readWorldUsage(world, sources))))
  }
  const analysisGeneration = summarizeUsage(reportCalls, reportFailures)
  const worldTotal = combineUsage([...worlds.map(world => world.usage),
    ...(worldsUnavailable ? [summarizeUsage(undefined)] : [])])
  const overall = combineUsage([sharedPreparation, worldTotal, analysisGeneration])
  return { sharedPreparation, worlds, worldsUnavailable, worldTotal, analysisGeneration, overall }
}

async function readDocumentUsage(setId: string, revision: number, sources: AnalysisSources): Promise<ResourceUsage> {
  let documents: DocumentRecord[]
  try {
    const set = await sources.documents.readSet(setId, revision)
    documents = set.documents
  } catch (error) {
    if (isMissingFileError(error) || error instanceof DocumentError && error.code === "source_revision_unavailable") return summarizeUsage(undefined)
    throw error
  }
  const usage: ResourceUsage[] = []
  for (let offset = 0; offset < documents.length; offset += ACCOUNTING_READ_CONCURRENCY) {
    usage.push(...await Promise.all(documents.slice(offset, offset + ACCOUNTING_READ_CONCURRENCY).map(async document => {
      const calls = await sources.documents.readCallRecords(setId, document.id, revision)
      if (!calls) return summarizeUsage(["csv", "txt", "md"].includes(document.format) ? [] : undefined)
      return summarizeUsage(calls.metrics.map(call => call.metrics), calls.failures.length)
    })))
  }
  return combineUsage(usage)
}

async function readWorldUsage(world: WorldRef, sources: AnalysisSources): Promise<WorldUsage> {
  const preparationId = z.uuid().safeParse(world.id).success ? world.id
    : world.runId?.startsWith("world-") && z.uuid().safeParse(world.runId.slice(6)).success ? world.runId.slice(6) : undefined
  let preparationVersion: number | undefined
  let preparationFailures = 0
  if (preparationId) {
    try {
      preparationVersion = (await sources.worlds.read(preparationId)).usageAccountingVersion
      preparationFailures = (await sources.worlds.readFailures(preparationId)).length
    } catch (error) { if (!isMissingFileError(error)) throw error; preparationVersion = undefined }
  }
  if (world.runId) {
    try {
      const run = await sources.runs.readManifest(world.runId)
      const records = await sources.runs.readModelCallRecords(world.runId)
      return { worldId: world.id, runId: world.runId, source: "run",
        usage: summarizeUsage(records.metrics, run.usageAccountingVersion === 1
          && (!preparationId || preparationVersion === 1) ? records.failures.length + preparationFailures : null) }
    } catch (error) { if (!isMissingFileError(error)) throw error }
  }
  let preparation: UsageMeasure[] | undefined
  if (preparationId) {
    try { preparation = (await sources.worlds.readMetrics(preparationId)).map(call => call.metrics) }
    catch (error) { if (!isMissingFileError(error)) throw error }
  }
  if (!preparation) return { worldId: world.id, runId: world.runId, source: "unavailable", usage: summarizeUsage(undefined) }
  const known = summarizeUsage(preparation, preparationVersion === 1 ? preparationFailures : null)
  // A missing run log may hide simulation calls; its preparation calls are only a lower bound.
  const usage: ResourceUsage = world.runId ? { ...summarizeUsage(undefined), observedCalls: known.observedCalls,
    unavailableTokenCalls: known.unavailableTokenCalls } : known
  return { worldId: world.id, runId: world.runId, source: "preparation", usage }
}
