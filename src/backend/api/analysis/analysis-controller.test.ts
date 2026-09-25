/**
 * Purpose: Verify real configured report invocation, persistence, citations, and idempotent API requests.
 * Pattern: API integration test with the explicit deterministic provider.
 * Usage: bun test src/backend/api/analysis/analysis-controller.test.ts
 * Related: src/backend/api/analysis/analysis-controller.ts, src/backend/runtime/analysis/jobs.ts
 */
import { seedRunState, seedRunManifest, seedRunEvent } from "@/backend/storage/runs/testing/fixtures"
import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm, unlink } from "node:fs/promises"
import { join, resolve } from "node:path"
import { tmpdir } from "node:os"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { initialSimulationState } from "@/backend/core/simulation/workflow/state"
import { AnalysisJobs } from "@/backend/runtime/analysis/jobs"
import { ModelAdmission } from "@/backend/runtime/model-admission"
import { RunStore } from "@/backend/storage/runs/run-store"
import { AnalysisStore } from "@/backend/storage/analysis/report-store"
import { BatchStore } from "@/backend/storage/multiverse/batch-store"
import { ScenarioBuildStore } from "@/backend/storage/scenario-builder/build-store"
import { DocumentStore } from "@/backend/storage/documents/document-store"
import { routeAnalysis } from "./analysis-controller"
import { ScenarioBuilderJobs } from "@/backend/runtime/scenario-builder/jobs"
import { WorldPreparationJobs } from "@/backend/runtime/worlds/preparation"
import { MultiverseJobs } from "@/backend/runtime/multiverse/jobs"
import { WorldStore } from "@/backend/storage/worlds/world-store"
import { extractTextEvidence } from "@/backend/core/documents/text"
import { parseBuilderRequest } from "@/backend/core/scenario-builder/contracts"
import { multiverseRequestSchema } from "@/shared/multiverse-schema"
import { Subscriptions } from "@/backend/runtime/events"
import { RoundContinuationStore } from "@/backend/runtime/round-continuation"
import { DocumentJobs } from "@/backend/runtime/documents"
import { createGenerationInvocation } from "@/backend/integrations/llm/generation"

test("a terminal run generates bounded Korean analysis through the configured observer and preserves citations", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-analysis-api-"))
  const previous = process.env.SIMULA_TEST_MODEL
  process.env.SIMULA_TEST_MODEL = "1"
  const settings = defaultSettings(); settings.providers.openai.apiKey = "unit-test-api-key"
  const runs = new RunStore({ rootDir: join(root, "runs") })
  const reports = new AnalysisStore(join(root, "reports"))
  const jobs = new AnalysisJobs(reports, { runs, batches: new BatchStore(join(root, "batches")), scenarios: new ScenarioBuildStore(join(root, "scenarios")),
    worlds: new WorldStore(join(root, "worlds")), documents: new DocumentStore(join(root, "documents")) },
    async () => settings, new ModelAdmission({ concurrency: 8 }))
  const id = crypto.randomUUID()
  const call = (request: Request) => routeAnalysis(jobs, request, new URL(request.url))
  try {
    const scenario = { text: "재무 담당자와 기술 책임자가 예산 제약을 검토합니다.", language: "ko" as const,
      controls: { numCast: 2, maxRound: 1, actionsPerType: 1, allowAdditionalCast: false, fastMode: true } }
    const run = await runs.createRun(scenario)
    const post = () => new Request("http://localhost/api/analysis", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": id }, body: JSON.stringify({ subject: { kind: "run", id: run.id } }) })
    expect((await call(post())).status).toBe(409)
    const state = initialSimulationState(run.id, scenario)
    state.roundReports = [{ roundIndex: 1, title: "검토", roundSummary: "비용 근거가 부족해 판단을 보류했습니다." }]
    state.stopReason = "simulation_done"
    await seedRunState(runs, state)
    await seedRunManifest(runs, { ...run, status: "completed", completedAt: new Date().toISOString() })
    const [first, duplicate] = await Promise.all([call(post()), call(post())])
    expect(first.status).toBe(202)
    expect((await first.json()).analysis.id).toBe((await duplicate.json()).analysis.id)
    await jobs.start(id)
    const record = await jobs.read(id)
    if (record.status !== "ready") throw new Error(JSON.stringify({ status: record.status,
      sections: record.report?.sections.map(section => ({ id: section.id, status: section.status })),
      unavailable: record.report?.unavailableInputs }))
    expect(record.status).toBe("ready")
    expect(record.report?.sections).toHaveLength(9)
    expect(record.report?.sections.every(section => /[가-힣]/.test(section.content))).toBe(true)
    const metrics = await reports.readMetrics(id)
    expect(metrics.length).toBeGreaterThan(0)
    expect(metrics.every(call => call.metrics.role === "observer")).toBe(true)
    const evidenceId = record.report?.evidenceIds[0]
    if (!evidenceId) throw new Error("Report did not retain references")
    const reference = await call(new Request(`http://localhost/api/analysis/${id}/reference?id=${encodeURIComponent(evidenceId)}`))
    expect((await reference.json()).reference.id).toBe(evidenceId)
    expect((await call(new Request(`http://localhost/api/analysis/${id}/reference?id=unrelated`))).status).toBe(404)
    await jobs.start(id)
    expect((await reports.readMetrics(id)).length).toBe(metrics.length)
    expect((await new AnalysisStore(reports.rootDir).read(id)).report).toEqual(record.report)
    const limitedId = crypto.randomUUID()
    const limited = await jobs.create(limitedId, { kind: "run", id: run.id })
    const seedLease = reports.execution(limited.id).claim()
    if (!seedLease) throw new Error("Missing fixture ownership")
    try { await reports.write({ ...limited, maxCalls: 1 }, seedLease) }
    finally { seedLease.release() }
    await jobs.start(limitedId)
    expect(await jobs.read(limitedId)).toMatchObject({ status: "canceled", stopReason: "call_budget" })
    expect((await reports.readMetrics(limitedId)).length).toBeLessThanOrEqual(1)
    expect((await runs.readManifest(run.id)).status).toBe("completed")
    expect((await runs.readState(run.id))?.roundReports).toEqual(state.roundReports)
  } finally {
    jobs.cancel(id); await jobs.start(id).catch(() => {})
    if (previous === undefined) delete process.env.SIMULA_TEST_MODEL; else process.env.SIMULA_TEST_MODEL = previous
    await rm(root, { recursive: true, force: true })
  }
})

test("one shared document scenario produces a source-linked multi-world report without counting repeated actions as worlds", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-batch-analysis-"))
  const previous = process.env.SIMULA_TEST_MODEL
  process.env.SIMULA_TEST_MODEL = "1"
  const settings = defaultSettings(); settings.providers.openai.apiKey = "unit-test-api-key"
  const getSettings = async () => settings
  const admission = new ModelAdmission({ concurrency: 50 })
  const runs = new RunStore({ rootDir: join(root, "runs") })
  const scenarios = new ScenarioBuildStore(join(root, "scenarios"))
  const documents = new DocumentStore(join(root, "documents"))
  const builders = new ScenarioBuilderJobs(scenarios, documents, getSettings, admission, (current, signal) => {
    const invoke = createGenerationInvocation(current, signal).invoke
    return call => call.id === "rule-information"
      ? Promise.resolve({ text: JSON.stringify({ entry: "All participants initially know the documented investment facts.", assumptions: [], evidenceIds: [] }), truncated: false })
      : call.id.startsWith("source-access-fact-") ? Promise.resolve({ text: "0", truncated: false }) : invoke(call)
  })
  const worlds = new WorldPreparationJobs(new WorldStore(join(root, "worlds")), scenarios, runs, getSettings, admission)
  const batches = new MultiverseJobs(new BatchStore(join(root, "batches")), { worlds, runs, getSettings, admission,
    subscriptions: new Subscriptions(), runningRuns: new Set(), continuations: new RoundContinuationStore() })
  const reports = new AnalysisStore(join(root, "reports"))
  const jobs = new AnalysisJobs(reports, { runs, batches: batches.store, scenarios, worlds: worlds.store, documents }, getSettings, admission)
  try {
    const set = await documents.createSet()
    const content = new TextEncoder().encode("The approved investment budget is 120 million won. The CTO and Finance must verify cost evidence.")
    const file = await documents.addFile(set.id, "investment.txt", content)
    await documents.saveExtraction(set.id, file.id, extractTextEvidence(file.id, content))
    const pdf = await documents.addFile(set.id, "overview.pdf",
      await readFile(resolve(import.meta.dir, "../../../../sample-input-items/overview.pdf")))
    await new DocumentJobs(documents, "soffice", getSettings, admission).start(set.id, pdf.id).completion
    expect((await documents.readDocument(set.id, pdf.id)).status).toBe("ready")
    const pdfCalls = await documents.readCallRecords(set.id, pdf.id)
    expect(pdfCalls?.metrics.map(call => call.page)).toEqual([1])
    const ready = await documents.readSet(set.id)
    const sourceId = crypto.randomUUID()
    await scenarios.create(sourceId, parseBuilderRequest({ documentSetId: ready.id, documentRevision: ready.revision, language: "en", fastMode: true }))
    await builders.start(sourceId).completion
    await builders.confirm(sourceId)
    const sharedCalls = await scenarios.readMetrics(sourceId)
    expect(sharedCalls?.length).toBeGreaterThan(0)
    const batch = await batches.create(crypto.randomUUID(), multiverseRequestSchema.parse({ scenarioId: sourceId, worldCount: 3, controls: { maxRound: 1, actionsPerType: 1, fastMode: true } }))
    await batches.start(batch.id)
    expect((await batches.read(batch.id)).status).toBe("completed")
    const id = crypto.randomUUID()
    const initialReport = await jobs.create(id, { kind: "batch", id: batch.id })
    // Later extraction is a different source revision, never input to the old worlds.
    await documents.updateStatus(set.id, file.id, "processing")
    await documents.saveExtraction(set.id, file.id, extractTextEvidence(file.id,
      new TextEncoder().encode("The replacement budget is 999999 million won.")))
    await documents.addFile(set.id, "later.txt", new TextEncoder().encode("An unrelated later source."))
    await jobs.start(id)
    const record = await jobs.read(id)
    if (record.status !== "ready") throw new Error(JSON.stringify({ status: record.status,
      sections: record.report?.sections.map(section => ({ id: section.id, status: section.status })),
      unavailable: record.report?.unavailableInputs }))
    expect(record.status).toBe("ready")
    expect(record.inputRevision).toBe(initialReport.inputRevision)
    expect((await jobs.lookup({ kind: "batch", id: batch.id })).freshness).toBe("outdated")
    expect(record.report?.coverage).toMatchObject({ requested: 3, completed: 3, analyzed: 3 })
    expect(record.report?.trajectories.categories.flatMap(category => category.worldIds)).toHaveLength(3)
    const references = await Promise.all((record.report?.evidenceIds ?? []).map(referenceId => reports.readReference(id, referenceId)))
    expect(references.some(reference => reference?.documentId === file.id && reference.locator?.kind === "text")).toBe(true)
    expect(references.some(reference => reference?.category === "simulation_observation")).toBe(true)
    expect(references.some(reference => reference?.documentId === file.id && reference.text.includes("120"))).toBe(true)
    expect(references.some(reference => reference?.text.includes("999999"))).toBe(false)
    expect(record.report?.unavailableInputs).toEqual([])
    const exportArtifact = await jobs.export(id)
    expect(exportArtifact.freshness).toBe("outdated")
    const worldCalls = await Promise.all((await batches.read(batch.id)).worlds.map(world => runs.readModelCallRecords(world.runId!)))
    expect(exportArtifact.accounting.sharedPreparation?.calls).toBe((sharedCalls?.length ?? 0) + (pdfCalls?.metrics.length ?? 0))
    expect(exportArtifact.accounting.worlds.map(world => world.usage.calls)).toEqual(worldCalls.map(calls => calls.metrics.length + calls.failures.length))
    expect(exportArtifact.accounting.overall.calls).toBe((sharedCalls?.length ?? 0) + (pdfCalls?.metrics.length ?? 0)
      + worldCalls.reduce((total, calls) => total + calls.metrics.length + calls.failures.length, 0) + (await reports.readMetrics(id)).length)
    const firstWorld = (await batches.read(batch.id)).worlds[0]
    const firstWorldCalls = worldCalls[0]
    const firstWorldAccounting = exportArtifact.accounting.worlds[0]
    const baselineCalls = exportArtifact.accounting.overall.calls
    if (!firstWorld?.runId || !firstWorldCalls || !firstWorldAccounting || baselineCalls === null) {
      throw new Error("The first world has no complete run accounting")
    }
    const failure = { role: "storyBuilder", step: "draft", attempt: 1, outcome: "failed" as const, queueWaitMs: 0 }
    await scenarios.appendFailure(sourceId, failure)
    await documents.appendFailure(set.id, pdf.id, { ...failure, taskId: `${pdf.id}:page:1` })
    await worlds.store.appendFailure(firstWorld.id, failure)
    await seedRunEvent(runs, { type: "model.attempt.failed", runId: firstWorld.runId,
      timestamp: new Date().toISOString(), failure })
    await reports.appendFailure(id, failure)
    const accounted = await jobs.accounting(id)
    expect(accounted.sharedPreparation).toMatchObject({ calls: (sharedCalls?.length ?? 0) + (pdfCalls?.metrics.length ?? 0) + 1,
      unavailableTokenCalls: (exportArtifact.accounting.sharedPreparation?.unavailableTokenCalls ?? 0) + 1, totalTokens: null })
    expect(accounted.worlds[0]?.usage).toMatchObject({ calls: firstWorldCalls.metrics.length + 2,
      unavailableTokenCalls: firstWorldAccounting.usage.unavailableTokenCalls + 2, totalTokens: null })
    expect(accounted.analysisGeneration).toMatchObject({ calls: (await reports.readMetrics(id)).length + 1,
      unavailableTokenCalls: exportArtifact.accounting.analysisGeneration.unavailableTokenCalls + 1, totalTokens: null })
    expect(accounted.overall.calls).toBe(baselineCalls + 4)
    expect(accounted.overall.totalTokens).toBeNull()
    await unlink(join(documents.rootDir, set.id, pdf.id, "metrics.jsonl"))
    const missingHistory = await jobs.accounting(id)
    expect(missingHistory.sharedPreparation).toEqual(accounted.sharedPreparation)
    expect(missingHistory.overall.calls).toBe(accounted.overall.calls)
  } finally {
    if (previous === undefined) delete process.env.SIMULA_TEST_MODEL; else process.env.SIMULA_TEST_MODEL = previous
    await rm(root, { recursive: true, force: true })
  }
}, 30_000)
