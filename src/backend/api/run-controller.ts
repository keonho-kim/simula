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
  runId: string
): Promise<Response> {
  if (runningRuns.has(runId)) {
    return json({ status: "already_running" }, { status: 202 })
  }
  const manifest = await store.readManifest(runId)
  const scenario = await store.readScenario(runId)
  const settings = await readSettings()
  runningRuns.add(runId)
  roundContinuations.clearRun(runId)
  void executeRun(store, subscriptions, runningRuns, roundContinuations, manifest, scenario, settings)
  return json({ status: "started" }, { status: 202 })
}

export function continueRunRound(
  runningRuns: Set<string>,
  roundContinuations: RoundContinuationStore,
  runId: string,
  roundIndex: number
): Response {
  if (!runningRuns.has(runId)) {
    return json({ error: "Run is not active." }, { status: 409 })
  }
  roundContinuations.continue(runId, roundIndex)
  return json({ status: "continued" })
}

export function cancelRun(
  runningRuns: Set<string>,
  roundContinuations: RoundContinuationStore,
  runId: string
): Response {
  if (!runningRuns.has(runId)) {
    return json({ error: "Run is not active." }, { status: 409 })
  }
  roundContinuations.cancel(runId)
  return json({ status: "canceled" }, { status: 202 })
}

export async function startReportCommentary(store: RunStore, subscriptions: Subscriptions, runningRuns: Set<string>, continuations: RoundContinuationStore, runId: string): Promise<Response> {
  if (runningRuns.has(runId)) return json({ error: "Run or commentary generation is already active." }, { status: 409 })
  runningRuns.add(runId)
  let dispatched = false
  try {
    const run = await store.readManifest(runId)
    if (!["completed", "failed", "canceled"].includes(run.status)) return json({ error: "Wait for the simulation to finish." }, { status: 409 })
    const state = await store.readState(runId)
    if (!state) return json({ error: "No stored simulation state is available." }, { status: 409 })
    const settings = await readSettings()
    continuations.clearRun(runId)
    const pending = { ...state, reportCommentary: { ...state.reportCommentary, status: "running" as const, nodes: state.reportCommentary?.nodes ?? [] } }
    await store.writeState(pending)
    dispatched = true
    void executeReportCommentary(store, subscriptions, runningRuns, continuations, pending, settings).catch(error => console.error("Report commentary persistence failed", error))
    return json({ status: "started" }, { status: 202 })
  } finally { if (!dispatched) runningRuns.delete(runId) }
}
