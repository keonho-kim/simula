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
