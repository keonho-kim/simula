/**
 * Purpose: Own analytical execution, scoped metrics reads, durable task reuse, and cancellation.
 * Pattern: Report lifecycle coordinator.
 * Usage: Composed by the server and controlled through the analysis API.
 * Related: src/backend/runtime/analysis/sources.ts, src/backend/core/simulation/outputs/analysis/graph.ts
 */
import { publishGenerationFailure, runWithGenerationLease } from "../generation/ownership"
import { GenerationCanceled, type ExecutionLease } from "@/backend/storage/generation/execution-lease"
import type { LLMSettings } from "@/shared/settings"
import type { AnalysisLookup, AnalysisRecord, AnalysisSubject, AnalyticalExport, AnalysisReference } from "@/shared/analytical-report"
import type { ModelCallAdmission } from "@/backend/integrations/llm/execution-context"
import type { AnalysisStore } from "@/backend/storage/analysis/report-store"
import type { GenerationDependencies } from "@/backend/core/generation/tasks"
import { createGenerationInvocation } from "@/backend/integrations/llm/generation"
import { runWithModelExecution } from "@/backend/integrations/llm/execution-context"
import { generateAnalyticalReport } from "@/backend/core/simulation/outputs/analysis/graph"
import { assembleAnalyticalExport } from "@/backend/core/simulation/outputs/analysis/export"
import { GenerationProgress } from "../generation/progress"
import { resolveAnalysisInput, type AnalysisSources } from "./sources"
import { readResourceAccounting } from "./accounting"
import { MODEL_ACCOUNTING_VERSION } from "@/shared/model-failure"

const MAX_REPORT_CALLS = 4096
const REPORT_TIMEOUT_MS = 60 * 60 * 1000
const EXPORT_READ_CONCURRENCY = 8
interface AnalysisJob { controller: AbortController; progress: GenerationProgress; completion: Promise<void>; stopReason?: AnalysisRecord["stopReason"] }
type AnalysisInvocation = (settings: LLMSettings, signal: AbortSignal) => GenerationDependencies["invoke"]

export class AnalysisJobs {
  private readonly active = new Map<string, AnalysisJob>()
  constructor(readonly store: AnalysisStore, private readonly sources: AnalysisSources, private readonly getSettings: () => Promise<LLMSettings>,
    private readonly admission: ModelCallAdmission, private readonly invoke?: AnalysisInvocation) {}

  async create(id: string, subject: AnalysisSubject): Promise<AnalysisRecord> {
    const source = await resolveAnalysisInput(subject, this.sources)
    return this.store.create({ id, subject, inputRevision: source.inputRevision, language: source.input.language,
      usageAccountingVersion: MODEL_ACCOUNTING_VERSION,
      fastMode: source.input.fastMode, createdAt: new Date().toISOString(), status: "running", maxCalls: MAX_REPORT_CALLS, deadlineAt: new Date(Date.now() + REPORT_TIMEOUT_MS).toISOString() })
  }
  async read(id: string): Promise<AnalysisRecord> {
    const record = await this.store.read(id)
    return record.status === "running" && !this.active.has(id) && !this.store.execution(id).isActive() ? { ...record, status: "failed" } : record
  }
  async lookup(subject: AnalysisSubject): Promise<AnalysisLookup> {
    const latest = await this.store.latest(subject)
    if (!latest) return { analysis: null, freshness: null }
    const analysis = await this.read(latest.id)
    try {
      const source = await resolveAnalysisInput(subject, this.sources)
      return { analysis, freshness: source.inputRevision === analysis.inputRevision && !source.sourceOutdated ? "current" : "outdated" }
    } catch {
      // An unreadable or nonterminal source cannot establish freshness; preserve the stored report.
      return { analysis, freshness: "unavailable" }
    }
  }
  async export(id: string): Promise<AnalyticalExport> {
    const record = await this.read(id)
    if (!record.report) throw new Error("The analysis has no accepted report to export.")
    const ids = [...new Set(record.report.evidenceIds)]
    const references: AnalysisReference[] = []
    for (let offset = 0; offset < ids.length; offset += EXPORT_READ_CONCURRENCY) {
      const group = await Promise.all(ids.slice(offset, offset + EXPORT_READ_CONCURRENCY).map(referenceId => this.store.readReference(id, referenceId)))
      for (const reference of group) {
        if (!reference) throw new Error("The analytical export is missing a required source reference.")
        references.push(reference)
      }
    }
    const metrics = await this.store.readMetrics(id)
    const failures = await this.store.readFailures(id)
    const accounting = await readResourceAccounting(record.subject, this.sources, metrics.map(call => call.metrics),
      record.usageAccountingVersion === 1 ? failures.length : null)
    const current = await this.store.read(id)
    if (JSON.stringify(current.report) !== JSON.stringify(record.report)) throw new Error("The accepted report changed while being exported; retry the download.")
    let freshness: AnalyticalExport["freshness"] = "unavailable"
    try {
      const source = await resolveAnalysisInput(record.subject, this.sources)
      freshness = source.inputRevision === record.inputRevision && !source.sourceOutdated ? "current" : "outdated"
    } catch { /* The accepted snapshot remains exportable when current sources are unavailable. */ }
    return assembleAnalyticalExport(record, references, metrics, accounting, freshness)
  }
  async accounting(id: string) {
    const record = await this.read(id)
    if (!record.report) throw new Error("The analysis has no accepted report to account for.")
    const metrics = await this.store.readMetrics(id)
    const failures = await this.store.readFailures(id)
    return readResourceAccounting(record.subject, this.sources, metrics.map(call => call.metrics),
      record.usageAccountingVersion === 1 ? failures.length : null)
  }
  start(id: string): Promise<void> {
    const previous = this.active.get(id)
    if (previous) return previous.completion
    const lease = this.store.execution(id).claim()
    if (!lease) return Promise.resolve()
    const controller = new AbortController()
    const progress = new GenerationProgress()
    const job: AnalysisJob = { controller, progress, completion: Promise.resolve() }
    this.active.set(id, job)
    job.completion = runWithGenerationLease(lease, controller, () => runWithModelExecution({ owner: id, admission: this.admission, signal: controller.signal,
      onModelCallFailure: failure => this.store.appendFailure(id, failure) }, () => this.execute(id, job, lease)))
      .finally(() => { controller.abort(new Error("Report execution ended.")); progress.finish(); this.active.delete(id) })
    return job.completion
  }
  progress(id: string): GenerationProgress | undefined { return this.active.get(id)?.progress }
  cancel(id: string): boolean {
    const job = this.active.get(id)
    const requested = this.store.execution(id).requestCancel()
    if (job) { job.stopReason = "user"; job.controller.abort(new GenerationCanceled()) }
    return requested || Boolean(job)
  }
  private async execute(id: string, job: AnalysisJob, lease: ExecutionLease): Promise<void> {
    const signal = job.controller.signal
    const progress = job.progress
    const record = await this.store.read(id)
    if (record.status === "ready") return
    const deadlineAt = new Date(Date.now() + REPORT_TIMEOUT_MS).toISOString()
    const timer = setTimeout(() => { job.stopReason = "deadline"; job.controller.abort(new Error("Report time budget exhausted.")) }, REPORT_TIMEOUT_MS)
    let calls = 0
    try {
      await this.store.write({ ...record, deadlineAt, stopReason: undefined, status: "running" }, lease)
      const source = await resolveAnalysisInput(record.subject, this.sources)
      if (source.inputRevision !== record.inputRevision) throw new Error("Report inputs changed; create a new report revision.")
      const settings = await this.getSettings()
      const generation = createGenerationInvocation(settings, signal, "observer")
      const invoke = this.invoke?.(settings, signal) ?? generation.invoke
      const report = await generateAnalyticalReport(id, source.input, {
        ...generation, signal, invoke: async call => {
          lease.assertActive()
          if (++calls > record.maxCalls) { job.stopReason = "call_budget"; job.controller.abort(new Error("Report call budget exhausted.")); signal.throwIfAborted() }
          return invoke({ ...call, onAdmission: async status => { lease.assertActive(); await call.onAdmission(status) } })
        },
        readTask: taskId => this.store.readTask(id, taskId), saveTask: task => this.store.saveTask(id, task, lease),
        saveReference: reference => this.store.saveReference(id, reference, lease),
        readReference: referenceId => this.store.readReference(id, referenceId),
        readWorld: runId => this.sources.runs.readState(runId),
        readDocument: async documentId => {
          if (!source.documentSetId || !source.input.documentIds.includes(documentId)) throw new Error("Document is outside this report's source scope.")
          return (await this.sources.documents.readExtraction(source.documentSetId, documentId, source.documentRevision)).blocks
        },
        emit: async event => { if (event.type === "metrics") await this.store.appendMetrics(id, event.metrics); progress.publish(event) },
      })
      signal.throwIfAborted()
      if ((await resolveAnalysisInput(record.subject, this.sources)).inputRevision !== record.inputRevision) throw new Error("Report inputs changed during generation.")
      await this.store.write({ ...record, deadlineAt, stopReason: undefined, report, status: report.sections.some(section => section.status === "failed") || report.unavailableInputs.length ? "partial" : "ready" }, lease)
    } catch (error) {
      await publishGenerationFailure(error, signal, canceled => this.store.write({ ...record, deadlineAt,
        stopReason: job.stopReason ?? (canceled ? "user" : undefined), status: canceled ? "canceled" : "failed" }, lease))
    }
    finally { clearTimeout(timer) }
  }
}
