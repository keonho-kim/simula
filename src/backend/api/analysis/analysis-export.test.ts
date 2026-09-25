/**
 * Purpose: Verify analytical exports preserve accepted provenance without starting model work.
 * Pattern: API integration test with persisted report artifacts.
 * Usage: bun test src/backend/api/analysis/analysis-export.test.ts
 * Related: src/backend/api/analysis/analysis-controller.ts, src/backend/runtime/analysis/jobs.ts
 */
import { seedRunManifest, seedRunEvent } from "@/backend/storage/runs/testing/fixtures"
import { createHash } from "node:crypto"
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { AnalysisJobs } from "@/backend/runtime/analysis/jobs"
import { ModelAdmission } from "@/backend/runtime/model-admission"
import { RunStore } from "@/backend/storage/runs/run-store"
import { AnalysisStore } from "@/backend/storage/analysis/report-store"
import { BatchStore } from "@/backend/storage/multiverse/batch-store"
import { ScenarioBuildStore } from "@/backend/storage/scenario-builder/build-store"
import { DocumentStore } from "@/backend/storage/documents/document-store"
import { WorldStore } from "@/backend/storage/worlds/world-store"
import { analysisFixture } from "@/backend/core/simulation/outputs/analysis/test-fixtures"
import { generateAnalyticalReport } from "@/backend/core/simulation/outputs/analysis/graph"
import { routeAnalysis } from "./analysis-controller"

test("accepted export includes bounded report, referenced evidence, rubric, and available metrics without a model call", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-analysis-export-"))
  const reports = new AnalysisStore(join(root, "reports"))
  const runs = new RunStore({ rootDir: join(root, "runs") })
  let modelSettingsReads = 0
  const jobs = new AnalysisJobs(reports, { runs, batches: new BatchStore(join(root, "batches")), scenarios: new ScenarioBuildStore(join(root, "scenarios")),
    worlds: new WorldStore(join(root, "worlds")), documents: new DocumentStore(join(root, "documents")) },
    async () => { modelSettingsReads++; throw new Error("Export must not resolve model settings") }, new ModelAdmission({ concurrency: 1 }))
  const get = (id: string) => {
    const request = new Request(`http://localhost/api/analysis/${id}/export?kind=json`)
    return routeAnalysis(jobs, request, new URL(request.url))
  }
  const accounting = (id: string) => {
    const request = new Request(`http://localhost/api/analysis/${id}/accounting`)
    return routeAnalysis(jobs, request, new URL(request.url))
  }
  try {
    const run = await runs.createRun({ text: "Review funding evidence.", language: "en", controls: { numCast: 2, maxRound: 1, actionsPerType: 1, fastMode: false, allowAdditionalCast: false } })
    await seedRunManifest(runs, { ...run, status: "completed", completedAt: "2026-09-23T10:00:00.000Z" })
    const record = await jobs.create(crypto.randomUUID(), { kind: "run", id: run.id })
    expect((await get(record.id)).status).toBe(409)
    const fixture = analysisFixture()
    const report = await generateAnalyticalReport(record.id, fixture.input, fixture.dependencies)
    report.sections[0] = { id: "strengths", status: "failed", summary: "", content: "", findings: [], evidenceIds: [] }
    const lease = reports.execution(record.id).claim()
    if (!lease) throw new Error("Missing fixture ownership")
    try {
      for (const reference of fixture.references.values()) await reports.saveReference(record.id, reference, lease)
      await reports.write({ ...record, status: "partial", report }, lease)
    } finally { lease.release() }
    const restoreReference = async (reference: import("@/shared/analytical-report").AnalysisReference) => {
      const repairLease = reports.execution(record.id).claim()
      if (!repairLease) throw new Error("Missing fixture ownership")
      try { await reports.saveReference(record.id, reference, repairLease) }
      finally { repairLease.release() }
    }
    await reports.appendMetrics(record.id, { role: "observer", step: "reportCommentary", attempt: 1, ttftMs: 5, durationMs: 20,
      inputTokens: 50, reasoningTokens: 0, outputTokens: 10, totalTokens: 60, tokenSource: "provider" })
    const response = await get(record.id)
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Disposition")).toContain(`${record.id}.analysis.json`)
    const artifact = await response.json()
    expect(artifact).toMatchObject({ formatVersion: 2, reportId: record.id, subject: record.subject, inputRevision: record.inputRevision,
      freshness: "current", executionStatus: "partial", report: { coverage: report.coverage } })
    expect(artifact.accounting).toMatchObject({ sharedPreparation: null, worlds: [{ worldId: run.id,
      usage: { calls: 0, totalTokens: 0 } }], analysisGeneration: { calls: 1, totalTokens: 60 }, overall: { calls: 1, totalTokens: 60 } })
    expect((await (await accounting(record.id)).json()).accounting).toEqual(artifact.accounting)
    expect(artifact.acceptedDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(artifact.report.sections.find((section: { id: string }) => section.id === "strengths").status).toBe("failed")
    expect(artifact.report.sections.find((section: { id: string }) => section.id === "threats").score.value).toBe(2)
    expect(artifact.references.map((reference: { id: string }) => reference.id)).toEqual(report.evidenceIds)
    expect(artifact.references.some((reference: { category: string }) => reference.category === "simulation_observation")).toBe(true)
    expect(artifact.metrics).toHaveLength(1)
    expect(artifact).not.toHaveProperty("deadlineAt")
    expect(modelSettingsReads).toBe(0)
    await seedRunEvent(runs, { type: "model.metrics", runId: run.id, timestamp: "2026-09-23T10:01:00.000Z", metrics: {
      role: "actor", step: "message", attempt: 1, ttftMs: 5, durationMs: 30, inputTokens: 0,
      reasoningTokens: 0, outputTokens: 0, totalTokens: 0, tokenSource: "unavailable",
    } })
    const mixedUsage = (await (await get(record.id)).json()).accounting
    expect(mixedUsage.overall).toMatchObject({ calls: 2, observedCalls: 2, totalTokens: null, unavailableTokenCalls: 1 })
    const missingPath = join(reports.rootDir, record.id, `evidence-${createHash("sha256").update(report.evidenceIds[0]!).digest("hex")}.json`)
    await rm(missingPath)
    expect((await get(record.id)).status).toBe(409)
    await restoreReference(fixture.references.get(report.evidenceIds[0]!)!)
    await seedRunManifest(runs, { ...run, status: "completed", completedAt: "2026-09-23T11:00:00.000Z" })
    expect((await (await get(record.id)).json()).freshness).toBe("outdated")
    await restoreReference({ id: "unrelated", category: "source_claim", text: "Should not leave its scope" })
    expect((await (await get(record.id)).json()).references.some((reference: { id: string }) => reference.id === "unrelated")).toBe(false)
    await rm(join(root, "runs", run.id), { recursive: true })
    const unavailable = await (await get(record.id)).json()
    expect(unavailable.freshness).toBe("unavailable")
    expect(unavailable.accounting.overall.calls).toBeNull()
  } finally { await rm(root, { recursive: true, force: true }) }
})
