/**
 * Purpose: Own scenario-build execution, recorded calls, cancellation, and review gates.
 * Pattern: Job lifecycle coordinator.
 * Usage: Composed once by the backend and called by scenario-builder HTTP routes.
 * Related: src/backend/core/scenario-builder/graph.ts, src/backend/storage/scenario-builder/build-store.ts
 */
import { publishGenerationFailure, runWithGenerationLease } from "@/backend/runtime/generation/ownership"
import { GenerationCanceled, type ExecutionLease } from "@/backend/storage/generation/execution-lease"
import type { LLMSettings } from "@/shared/settings"
import type { BuilderRequest, ScenarioBuildRecord } from "@/shared/scenario-builder"
import { buildScenario } from "@/backend/core/scenario-builder/graph"
import type { BuilderDependencies } from "@/backend/core/scenario-builder/contracts"
import { createGenerationInvocation } from "@/backend/integrations/llm/generation"
import { runWithModelExecution, type ModelCallAdmission } from "@/backend/integrations/llm/execution-context"
import type { DocumentStore } from "@/backend/storage/documents/document-store"
import type { ScenarioBuildStore } from "@/backend/storage/scenario-builder/build-store"
import { GenerationProgress } from "@/backend/runtime/generation/progress"

interface BuildJob { controller: AbortController; completion: Promise<void>; progress: GenerationProgress }
type InvokeBuilder = (settings: LLMSettings, signal: AbortSignal) => BuilderDependencies["invoke"]

export class ScenarioBuilderJobs {
  private readonly active = new Map<string, BuildJob>()

  constructor(readonly store: ScenarioBuildStore, private readonly documents: DocumentStore,
    private readonly getSettings: () => Promise<LLMSettings>, private readonly admission: ModelCallAdmission,
    private readonly invoke?: InvokeBuilder) {}

  async captureSource(request: BuilderRequest) {
    return this.documents.captureRevision(request.documentSetId, request.documentRevision)
  }

  start(id: string): { completion: Promise<void>; alreadyRunning: boolean } {
    const previous = this.active.get(id)
    if (previous) return { completion: previous.completion, alreadyRunning: true }
    const lease = this.store.execution(id).claim()
    if (!lease) return { completion: Promise.resolve(), alreadyRunning: true }
    const controller = new AbortController()
    const progress = new GenerationProgress()
    const completion = runWithGenerationLease(lease, controller, () => runWithModelExecution({ owner: id, admission: this.admission, signal: controller.signal,
      onModelCallFailure: failure => this.store.appendFailure(id, failure) },
      () => this.execute(id, controller.signal, progress, lease))).finally(() => {
        controller.abort(new Error("Scenario generation ended."))
        progress.finish(); this.active.delete(id)
      })
    this.active.set(id, { controller, progress, completion })
    return { completion, alreadyRunning: false }
  }

  cancel(id: string): boolean {
    const job = this.active.get(id)
    const requested = this.store.execution(id).requestCancel()
    job?.controller.abort(new GenerationCanceled())
    return requested || Boolean(job)
  }

  isRunning(id: string): boolean { return this.active.has(id) || this.store.execution(id).isActive() }

  progress(id: string): GenerationProgress | undefined { return this.active.get(id)?.progress }

  async confirm(id: string): Promise<ScenarioBuildRecord> {
    const lease = this.store.execution(id).claim()
    if (!lease) throw new Error("Wait for scenario generation to finish.")
    try {
      const record = await this.store.read(id)
      if (record.status === "confirmed") return record
      if (record.status !== "review" || !record.specification || record.specification.issues.some(issue => issue.blocking)) {
        throw new Error("Resolve blocking scenario issues before confirmation.")
      }
      await this.captureSource(record.request)
      const confirmed: ScenarioBuildRecord = { ...record, status: "confirmed", specification: { ...record.specification, status: "confirmed" } }
      await this.store.write(confirmed, lease)
      return confirmed
    } finally { lease.release() }
  }

  private async execute(id: string, signal: AbortSignal, progress: GenerationProgress, lease: ExecutionLease): Promise<void> {
    const record = await this.store.read(id)
    if (record.status === "confirmed" || record.status === "review") return
    try {
      await this.store.write({ ...record, status: "running", issue: undefined }, lease)
      const set = await this.captureSource(record.request)
      const documentIds = set.documents.map(document => document.id)
      const settings = await this.getSettings()
      const invocation = createGenerationInvocation(settings, signal)
      const invoke = this.invoke?.(settings, signal) ?? invocation.invoke
      const specification = await buildScenario(id, record.request, documentIds, {
        ...invocation, signal,
        readEvidence: async documentId => (await this.documents.readExtraction(record.request.documentSetId, documentId, record.request.documentRevision)).blocks,
        readTask: taskId => this.store.readTask(id, taskId), saveTask: task => this.store.saveTask(id, task, lease),
        emit: async event => { if (event.type === "metrics") await this.store.appendMetrics(id, event.metrics); progress.publish(event) },
        invoke: call => {
          lease.assertActive()
          return invoke({ ...call, onAdmission: async status => { lease.assertActive(); await call.onAdmission(status) } })
        },
      })
      signal.throwIfAborted()
      for (const document of set.documents) {
        if (document.status === "partial") specification.issues.push({ scope: document.id,
          description: "Source extraction is partial; inspect unprocessed regions before confirming the scenario.", blocking: true })
      }
      if (specification.issues.some(issue => issue.blocking)) specification.status = "blocked"
      await this.store.write({ ...record, status: specification.status, specification, issue: undefined }, lease)
    } catch (error) {
      await publishGenerationFailure(error, signal, canceled => this.store.write({ ...record, status: canceled ? "canceled" : "failed",
        issue: canceled ? "Scenario generation canceled." : "Scenario generation failed. Check document readiness and model settings, then retry; accepted tasks are retained." }, lease))
    }
  }
}
