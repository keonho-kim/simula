/**
 * Purpose: Own world preparation, cancellation, source validation, and idempotent run handoff.
 * Pattern: World lifecycle coordinator.
 * Usage: Composed by the backend and invoked through the world API.
 * Related: src/backend/core/story-builder/world/graph.ts, src/backend/storage/worlds/world-store.ts
 */
import { publishGenerationFailure, runWithGenerationLease, type ExecutionParent } from "../generation/ownership"
import { GenerationCanceled, type ExecutionLease } from "@/backend/storage/generation/execution-lease"
import { buildWorldRunId } from "@/backend/storage/runs/run-id"
import type { LLMSettings } from "@/shared/settings"
import type { WorldPreparationRequest } from "@/shared/world-preparation"
import type { RunEvent, RunManifest } from "@/shared/run"
import { prepareWorldStory } from "@/backend/core/story-builder/world/graph"
import { scenarioFromWorld } from "@/backend/core/story-builder/world/handoff"
import type { GenerationDependencies } from "@/backend/core/generation/tasks"
import { createGenerationInvocation } from "@/backend/integrations/llm/generation"
import { runWithModelExecution, type ModelCallAdmission } from "@/backend/integrations/llm/execution-context"
import type { ScenarioBuildStore } from "@/backend/storage/scenario-builder/build-store"
import type { RunStore } from "@/backend/storage/runs/run-store"
import type { WorldStore } from "@/backend/storage/worlds/world-store"
import { GenerationProgress } from "@/backend/runtime/generation/progress"

interface PreparationJob { controller: AbortController; completion: Promise<void>; progress: GenerationProgress }
type InvocationFactory = (settings: LLMSettings, signal: AbortSignal) => GenerationDependencies["invoke"]

export class WorldPreparationJobs {
  private readonly active = new Map<string, PreparationJob>()
  private readonly linking = new Map<string, Promise<RunManifest>>()

  constructor(readonly store: WorldStore, private readonly scenarios: ScenarioBuildStore, private readonly runs: RunStore,
    private readonly getSettings: () => Promise<LLMSettings>, private readonly admission: ModelCallAdmission,
    private readonly invoke?: InvocationFactory) {}

  async source(request: WorldPreparationRequest) {
    const record = await this.scenarios.read(request.scenarioId)
    if (record.status !== "confirmed" || !record.specification || record.specification.status !== "confirmed" || record.specification.issues.some(issue => issue.blocking)) throw new Error("Confirm the shared scenario before preparing a world.")
    return record.specification
  }

  start(id: string, settings?: LLMSettings, parent?: ExecutionParent): { completion: Promise<void>; alreadyRunning: boolean } {
    const previous = this.active.get(id)
    if (previous) return { completion: previous.completion, alreadyRunning: true }
    const lease = this.store.execution(id).claim()
    if (!lease) return { completion: Promise.resolve(), alreadyRunning: true }
    const controller = new AbortController()
    const stopFromParent = () => controller.abort(parent?.signal.reason)
    parent?.signal.addEventListener("abort", stopFromParent, { once: true })
    if (parent?.signal.aborted) stopFromParent()
    const assertActive = () => { lease.assertActive(); parent?.assertActive() }
    const progress = new GenerationProgress()
    const completion = runWithGenerationLease(lease, controller, () => runWithModelExecution({ owner: id, admission: this.admission, signal: controller.signal, assertActive,
      onModelCallFailure: failure => this.store.appendFailure(id, failure) },
      () => this.execute(id, controller.signal, progress, lease, assertActive, settings))).finally(() => {
        parent?.signal.removeEventListener("abort", stopFromParent)
        controller.abort(new Error("World preparation ended."))
        progress.finish(); this.active.delete(id)
      })
    this.active.set(id, { controller, completion, progress })
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

  materializeRun(id: string): Promise<RunManifest> {
    const existing = this.linking.get(id)
    if (existing) return existing
    const work = this.linkRun(id).finally(() => this.linking.delete(id))
    this.linking.set(id, work)
    return work
  }

  private async linkRun(id: string): Promise<RunManifest> {
    const lease = this.store.execution(id).claim()
    if (!lease) throw new Error("World preparation or run handoff is already running; retry after it finishes.")
    const controller = new AbortController()
    return runWithGenerationLease(lease, controller, async () => {
      const record = await this.store.read(id)
      if (record.runId) return this.runs.readManifest(record.runId)
      if (record.status !== "ready" || !record.story) throw new Error("Wait for a valid world starting state before launching.")
      const source = await this.source(record.request)
      const scenario = scenarioFromWorld(record.story, source, record.request.controls)
      const runId = buildWorldRunId(id)
      const initialEvents: RunEvent[] = (await this.store.readMetrics(id)).map(value => ({ type: "model.metrics", runId, timestamp: value.timestamp, metrics: value.metrics }))
      lease.assertActive()
      const run = await this.runs.createRun(scenario, { id: runId, initialEvents, batchId: record.batchId, worldLease: lease })
      controller.signal.throwIfAborted()
      await this.store.write({ ...record, runId }, lease)
      return run
    })
  }

  private async execute(id: string, signal: AbortSignal, progress: GenerationProgress, lease: ExecutionLease, assertActive: () => void, executionSettings?: LLMSettings): Promise<void> {
    const record = await this.store.read(id)
    if (record.status === "ready") return
    try {
      assertActive()
      await this.store.write({ ...record, status: "preparing", issue: undefined }, lease)
      const source = await this.source(record.request)
      if (source.version !== record.sourceScenarioVersion) throw new Error("Confirmed scenario revision changed.")
      const settings = executionSettings ?? await this.getSettings()
      const invocation = createGenerationInvocation(settings, signal)
      const invoke = this.invoke?.(settings, signal) ?? invocation.invoke
      const story = await prepareWorldStory(id, source, record.request.controls.fastMode, {
        ...invocation, signal, invoke: call => {
          assertActive()
          return invoke({ ...call, onAdmission: async status => { assertActive(); await call.onAdmission(status) } })
        },
        readTask: taskId => this.store.readTask(id, taskId), saveTask: task => { assertActive(); return this.store.saveTask(id, task, lease) },
        emit: async event => { if (event.type === "metrics") await this.store.appendMetrics(id, event.metrics); progress.publish(event) },
      })
      signal.throwIfAborted()
      assertActive()
      await this.store.write({ ...record, status: "ready", story, issue: undefined }, lease)
    } catch (error) {
      await publishGenerationFailure(error, signal, canceled => this.store.write({ ...record, status: canceled ? "canceled" : "failed",
        issue: canceled ? "World preparation canceled." : "World preparation failed. Verify the confirmed scenario and model settings, then retry the preserved tasks." }, lease))
    }
  }
}
