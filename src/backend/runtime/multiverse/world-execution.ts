/**
 * Purpose: Prepare and execute one batch world while preserving its independent artifacts and controls.
 * Pattern: World execution use case.
 * Usage: Invoked concurrently by the batch lifecycle owner.
 * Related: src/backend/runtime/multiverse/jobs.ts, src/backend/runtime/worlds/preparation.ts
 */
import { GenerationCanceled, GenerationOwnershipLost, type ExecutionLease } from "@/backend/storage/generation/execution-lease"
import type { BatchWorld, MultiverseRecord } from "@/shared/multiverse"
import type { LLMSettings } from "@/shared/settings"
import type { ModelCallAdmission } from "@/backend/integrations/llm/execution-context"
import type { BatchStore } from "@/backend/storage/multiverse/batch-store"
import type { RunStore } from "@/backend/storage/runs/run-store"
import type { WorldPreparationJobs } from "../worlds/preparation"
import type { Subscriptions } from "../events"
import type { RoundContinuationStore } from "../round-continuation"
import { executeRun } from "../execute-run"
import { ServerRoundProgression } from "./rounds"

export interface BatchExecutionDependencies {
  worlds: WorldPreparationJobs
  runs: RunStore
  subscriptions: Subscriptions
  runningRuns: Set<string>
  continuations: RoundContinuationStore
  admission: ModelCallAdmission
  getSettings: () => Promise<LLMSettings>
}
export interface ActiveBatch {
  lease: ExecutionLease
  controller: AbortController
  canceled: Set<string>
  rounds: Map<string, ServerRoundProgression>
  runIds: Map<string, string>
  completion: Promise<void>
  stopReason?: "user" | "deadline"
  wakeControls?: () => Promise<void>
  controlFailure?: unknown
}
export type UpdateBatchWorld = (worldId: string, update: Partial<BatchWorld>) => Promise<void>

export async function executeBatchWorld(batch: MultiverseRecord, world: BatchWorld, active: ActiveBatch,
  store: BatchStore, deps: BatchExecutionDependencies, settings: LLMSettings, update: UpdateBatchWorld): Promise<void> {
  const stopped = () => active.canceled.has(world.id) || active.controller.signal.aborted || !!active.stopReason
  const check = () => { active.lease.assertActive(); if (stopped()) throw new Error("Batch world canceled.") }
  try {
    if (["completed", "canceled"].includes(world.status)) return
    check()
    await update(world.id, { status: "preparing", issue: undefined, continueAt: undefined })
    await deps.worlds.store.create(world.id, { scenarioId: batch.request.scenarioId, controls: batch.request.controls }, batch.sourceScenarioVersion, batch.id)
    check()
    await deps.worlds.start(world.id, settings, { signal: active.controller.signal, assertActive: () => active.lease.assertActive() }).completion
    check()
    const prepared = await deps.worlds.store.read(world.id)
    if (prepared.status !== "ready") throw new Error("World preparation failed; retry the preserved preparation tasks.")
    const run = await deps.worlds.materializeRun(world.id)
    active.runIds.set(world.id, run.id)
    if (run.batchId !== batch.id) throw new Error("World run has a different batch owner.")
    if (run.status !== "created") {
      await update(world.id, { runId: run.id, status: run.status === "running" ? "interrupted" : run.status,
        issue: run.status === "running" ? "Simulation was interrupted. Its history is preserved; mid-round resume is not yet available." : undefined })
      return
    }
    const scenario = await deps.runs.readScenario(run.id)
    check()
    if (deps.runningRuns.has(run.id)) throw new Error("World execution already has an owner.")
    deps.runningRuns.add(run.id)
    deps.continuations.clearRun(run.id)
    const automatic = store.commands(batch.id).automatic(world.id, active.lease)
    const rounds = new ServerRoundProgression(automatic, AbortSignal.any([deps.continuations.signal(run.id), active.controller.signal]), patch => update(world.id, patch))
    active.rounds.set(world.id, rounds)
    try {
      await update(world.id, { status: "running", runId: run.id, issue: undefined })
      check()
      await executeRun(deps.runs, deps.subscriptions, deps.runningRuns, deps.continuations, run, scenario, settings, deps.admission, {
        parent: { signal: active.controller.signal, assertActive: () => active.lease.assertActive() },
        commentary: "defer", waitForNextRound: index => rounds.wait(index),
        onEvent: async event => { if (event.type === "round.completed") await update(world.id, { roundIndex: event.roundIndex }) },
      })
      const terminal = await deps.runs.readManifest(run.id)
      await update(world.id, { status: terminal.status === "running" || terminal.status === "created" ? "interrupted" : terminal.status,
        continueAt: undefined, issue: terminal.status === "failed" ? "World simulation failed. Preserved records remain available." : undefined })
    } finally {
      rounds.dispose(); active.rounds.delete(world.id)
      deps.runningRuns.delete(run.id); deps.continuations.clearRun(run.id)
    }
  } catch (error) {
    if (error instanceof GenerationOwnershipLost) throw error
    const canceled = stopped() || error instanceof GenerationCanceled
    await update(world.id, { status: canceled ? "canceled" : "failed", continueAt: undefined,
      issue: canceled ? undefined : "World work could not finish. Retry preparation or inspect the preserved simulation records." })
  } finally { active.runIds.delete(world.id) }
}
