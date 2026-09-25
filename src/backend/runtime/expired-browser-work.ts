/**
 * Purpose: Cancel expired browser work and remove its temporary server artifacts.
 * Pattern: Session lifecycle use case.
 * Usage: Called by BrowserSessions when a disconnected browser exceeds its grace period.
 * Related: src/backend/runtime/browser-sessions.ts, server.ts
 */
import { readdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import type { RunStore } from "@/backend/storage/runs/run-store"
import type { DocumentStore } from "@/backend/storage/documents/document-store"
import type { DocumentJobs } from "@/backend/runtime/documents"
import type { ScenarioBuilderJobs } from "@/backend/runtime/scenario-builder/jobs"
import type { WorldPreparationJobs } from "@/backend/runtime/worlds/preparation"
import type { MultiverseJobs } from "@/backend/runtime/multiverse/jobs"
import type { AnalysisJobs } from "@/backend/runtime/analysis/jobs"
import type { RoundContinuationStore } from "@/backend/runtime/round-continuation"
import type { BrowserResource } from "./browser-sessions"

interface TemporaryWork {
  runs: RunStore
  runningRuns: Set<string>
  continuations: RoundContinuationStore
  documents: DocumentStore
  documentJobs: DocumentJobs
  builds: ScenarioBuilderJobs
  worlds: WorldPreparationJobs
  batches: MultiverseJobs
  analyses: AnalysisJobs
}

export async function expireBrowserWork(resource: BrowserResource, work: TemporaryWork): Promise<void> {
  const { kind, id } = resource
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(id)) return
  let documentIds: string[] = []
  if (kind === "run") { work.runs.execution(id).requestCancel(); work.continuations.cancel(id) }
  if (kind === "build") work.builds.cancel(id)
  if (kind === "world") work.worlds.cancel(id)
  if (kind === "batch") await work.batches.cancel(id)
  if (kind === "analysis") work.analyses.cancel(id)
  if (kind === "document-set") {
    const set = await work.documents.readSet(id)
    documentIds = set.documents.map(document => document.id)
    for (const document of set.documents) work.documentJobs.cancel(id, document.id)
  }
  const isActive = () => {
    if (kind === "run") return work.runningRuns.has(id) || work.runs.execution(id).isActive()
    if (kind === "build") return work.builds.isRunning(id)
    if (kind === "world") return work.worlds.isRunning(id)
    if (kind === "batch") return work.batches.store.execution(id).isActive()
    if (kind === "analysis") return work.analyses.store.execution(id).isActive()
    return documentIds.some(documentId => work.documentJobs.isActive(id, documentId))
  }
  for (let attempt = 0; attempt < 20 && isActive(); attempt++) await delay(500)
  if (isActive()) return // Preserve in-flight files until process shutdown rather than racing a writer.
  const root = kind === "run" ? work.runs.rootDir : kind === "build" ? work.builds.store.rootDir
    : kind === "world" ? work.worlds.store.rootDir : kind === "batch" ? work.batches.store.rootDir
      : kind === "analysis" ? work.analyses.store.rootDir : work.documents.rootDir
  await rm(join(root, id), { recursive: true, force: true })
  if (kind === "run") work.runs.forgetRun(id)
}

export async function removeOrphanActiveRoots(tempRoot: string): Promise<void> {
  const entries = await readdir(tempRoot, { withFileTypes: true })
  await Promise.all(entries.filter(entry => entry.isDirectory()).map(async entry => {
    const match = /^simula-active-(\d+)-/.exec(entry.name)
    if (!match) return
    try { process.kill(Number(match[1]), 0); return }
    catch (error) { if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ESRCH") return }
    await rm(join(tempRoot, entry.name), { recursive: true, force: true })
  }))
}
