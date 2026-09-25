/**
 * Purpose: Coordinate run start, cancellation, round approval, and report regeneration requests.
 * Pattern: HTTP use-case controller.
 * Usage: Called by run routes after identifiers are resolved.
 * Related: src/backend/runtime/execute-run.ts, src/backend/runtime/round-continuation.ts
 */
import type { LLMSettings } from "@/shared/settings"
import type { ModelCallAdmission } from "@/backend/integrations/llm/execution-context"
import { executeReportCommentary } from "@/backend/runtime/report-commentary"
import { executeRun } from "@/backend/runtime/execute-run"
import type { RunStore } from "@/backend/storage/runs/run-store"
import type { Subscriptions } from "@/backend/runtime/events"
import { json } from "@/backend/api/responses"
import type { RoundContinuationStore } from "@/backend/runtime/round-continuation"
import { readSettings } from "@/backend/storage/settings-store"

export async function startRun(
  store: RunStore,
  subscriptions: Subscriptions,
  runningRuns: Set<string>,
  roundContinuations: RoundContinuationStore,
  runId: string,
  admission: ModelCallAdmission,
  getSettings: () => Promise<LLMSettings> = readSettings
): Promise<Response> {
  if (runningRuns.has(runId) || store.execution(runId).isActive()) {
    return json({ status: "already_running" }, { status: 202 })
  }
  runningRuns.add(runId)
  roundContinuations.clearRun(runId)
  let dispatched = false
  try {
    const manifest = await store.readManifest(runId)
    if (manifest.batchId) return json({ error: "Start this world through its batch." }, { status: 409 })
    if (manifest.status === "completed") return json({ status: "already_completed" })
    if (manifest.status !== "created") return json({ error: "This run already has execution history. Open its result or prepare a new world." }, { status: 409 })
    const scenario = await store.readScenario(runId)
    const settings = await getSettings()
    dispatched = true
    void executeRun(store, subscriptions, runningRuns, roundContinuations, manifest, scenario, settings, admission).catch(() => {
      runningRuns.delete(runId)
      console.error("Run persistence failed", { runId })
    }).finally(() => runningRuns.delete(runId))
    return json({ status: "started" }, { status: 202 })
  } finally { if (!dispatched) runningRuns.delete(runId) }
}

export function continueRunRound(
  store: RunStore,
  roundContinuations: RoundContinuationStore,
  runId: string,
  roundIndex: number
): Response {
  if (!store.roundApprovals(runId).approve(roundIndex)) {
    return json({ error: "This round is not awaiting approval in the active execution." }, { status: 409 })
  }
  roundContinuations.notify(runId)
  return json({ status: "continued" })
}

export function cancelRun(
  store: RunStore,
  runningRuns: Set<string>,
  roundContinuations: RoundContinuationStore,
  runId: string
): Response {
  const requested = store.execution(runId).requestCancel()
  if (!requested && !runningRuns.has(runId)) return json({ error: "Run is not active." }, { status: 409 })
  if (runningRuns.has(runId)) roundContinuations.cancel(runId)
  return json({ status: "canceled" }, { status: 202 })
}

export async function startReportCommentary(store: RunStore, subscriptions: Subscriptions, runningRuns: Set<string>, continuations: RoundContinuationStore, runId: string, admission: ModelCallAdmission): Promise<Response> {
  if (runningRuns.has(runId) || store.execution(runId).isActive()) return json({ error: "Run or commentary generation is already active." }, { status: 409 })
  runningRuns.add(runId)
  continuations.clearRun(runId)
  let dispatched = false
  try {
    const run = await store.readManifest(runId)
    if (!["completed", "failed", "canceled"].includes(run.status)) return json({ error: "Wait for the simulation to finish." }, { status: 409 })
    const state = await store.readState(runId)
    if (!state) return json({ error: "No stored simulation state is available." }, { status: 409 })
    const settings = await readSettings()
    dispatched = true
    void executeReportCommentary(store, subscriptions, runningRuns, continuations, state, settings, admission).catch(() => console.error("Report commentary persistence failed", { runId })).finally(() => runningRuns.delete(runId))
    return json({ status: "started" }, { status: 202 })
  } finally { if (!dispatched) runningRuns.delete(runId) }
}
