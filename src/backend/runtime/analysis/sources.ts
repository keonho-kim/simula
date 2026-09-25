/**
 * Purpose: Resolve terminal report subjects to versioned scenario, document, and world references.
 * Pattern: Runtime evidence adapter.
 * Usage: Called before report creation, execution, and final publication.
 * Related: src/backend/runtime/analysis/jobs.ts, src/backend/core/simulation/outputs/analysis/contracts.ts
 */
import { isMissingFileError } from "@/backend/storage/file-errors"
import { createHash } from "node:crypto"
import type { AnalysisSubject } from "@/shared/analytical-report"
import type { ScenarioInput } from "@/shared/scenario"
import type { AnalysisInput, AnalysisWorld } from "@/backend/core/simulation/outputs/analysis/contracts"
import type { RunStore } from "@/backend/storage/runs/run-store"
import type { BatchStore } from "@/backend/storage/multiverse/batch-store"
import type { ScenarioBuildStore } from "@/backend/storage/scenario-builder/build-store"
import type { DocumentStore } from "@/backend/storage/documents/document-store"
import type { WorldStore } from "@/backend/storage/worlds/world-store"

export interface AnalysisSources { runs: RunStore; batches: BatchStore; scenarios: ScenarioBuildStore; worlds: WorldStore; documents: DocumentStore }

export async function resolveAnalysisInput(subject: AnalysisSubject, stores: AnalysisSources) {
  let scenarioId: string | undefined
  let scenario: ScenarioInput | undefined
  let sourceVersion: number | undefined
  let worlds: AnalysisWorld[]
  let fastMode: boolean
  let revision: unknown
  if (subject.kind === "batch") {
    const batch = await stores.batches.read(subject.id)
    if (batch.status === "running" || batch.worlds.some(world => ["pending", "preparing", "running", "waiting"].includes(world.status))) throw new Error("Wait for every world to become terminal before generating the batch report.")
    worlds = batch.worlds.map(world => {
      if (world.status !== "completed" && world.status !== "failed" && world.status !== "canceled" && world.status !== "interrupted") throw new Error("World is still active.")
      return { id: world.id, runId: world.runId, status: world.status }
    })
    scenarioId = batch.request.scenarioId; sourceVersion = batch.sourceScenarioVersion; fastMode = batch.request.controls.fastMode; revision = batch.revision
  } else {
    const run = await stores.runs.readManifest(subject.id)
    if (run.status === "created" || run.status === "running") throw new Error("Wait for simulation completion before generating the report.")
    scenario = await stores.runs.readScenario(run.id)
    worlds = [{ id: run.id, runId: run.id, status: run.status }]
    scenarioId = scenario.world?.sourceScenarioId; sourceVersion = scenario.world?.sourceScenarioVersion
    fastMode = scenario.controls.fastMode; revision = { status: run.status, completedAt: run.completedAt }
  }
  let input: AnalysisInput
  let documentSetId: string | undefined
  let sourceOutdated = false
  let documentRevision: number | undefined
  if (scenarioId) {
    const build = await stores.scenarios.read(scenarioId)
    const spec = build.specification
    if (build.status !== "confirmed" || !spec || spec.status !== "confirmed" || spec.version !== sourceVersion) throw new Error("Confirmed scenario revision is unavailable.")
    const sources = await stores.documents.readSet(spec.documentSetId, spec.documentRevision)
    try { sourceOutdated = (await stores.documents.readSet(spec.documentSetId)).revision !== spec.documentRevision }
    catch (error) { if (!isMissingFileError(error)) throw error; sourceOutdated = true }
    documentSetId = sources.id; documentRevision = sources.revision
    input = { subject, language: spec.language, fastMode, scenarioText: JSON.stringify({ situation: spec.situation, participants: spec.participants, rules: spec.rules, issues: spec.issues }),
      scenarioCategory: "scenario_assumption", worlds, documentIds: sources.documents.map(document => document.id) }
  } else {
    if (!scenario) throw new Error("Report scenario is unavailable.")
    input = { subject, language: scenario.language ?? "en", fastMode, scenarioText: scenario.text, scenarioCategory: "user_constraint", worlds, documentIds: [] }
  }
  const inputRevision = createHash("sha256").update(JSON.stringify({ input, revision, sourceVersion, documentRevision })).digest("hex")
  return { input, inputRevision, documentSetId, documentRevision, sourceOutdated }
}
