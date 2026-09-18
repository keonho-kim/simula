import { expect, spyOn, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { RunStore } from "@/backend/storage/runs/run-store"
import { initialSimulationState } from "@/backend/core/simulation/workflow/state"
import { parseScenarioDocument } from "@/backend/core/scenario"
import { defaultSettings } from "@/backend/core/settings/defaults"
import * as invocation from "@/backend/integrations/llm/invoke"
import { Subscriptions } from "./events"
import { RoundContinuationStore } from "./round-continuation"
import { executeReportCommentary } from "./report-commentary"
import { route } from "@/backend/api/routes"

test("commentary interruption preserves results and releases the lock; stale running state is retryable", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-commentary-"))
  const spy = spyOn(invocation, "invokeRoleTextWithMetrics").mockRejectedValue(new Error("offline"))
  try {
    const store = new RunStore({ rootDir: root })
    const scenario = parseScenarioDocument("---\nnum_cast: 2\n---\nTest")
    const run = await store.createRun(scenario)
    const state = initialSimulationState(run.id, scenario)
    state.roundReports = [{ roundIndex: 1, title: "Review", roundSummary: "Discussed the decision" }]
    await store.writeManifest({ ...run, status: "completed" })
    const runningRuns = new Set([run.id])
    const subscriptions = new Subscriptions()
    const roundContinuations = new RoundContinuationStore()
    await executeReportCommentary(store, subscriptions, runningRuns, roundContinuations, state, defaultSettings())
    const saved = await store.readState(run.id)
    expect(saved?.reportCommentary?.status).toBe("failed")
    expect(saved?.roundReports).toEqual(state.roundReports)
    expect(runningRuns.size).toBe(0)
    expect((await store.readManifest(run.id)).status).toBe("completed")
    await store.writeState({ ...state, reportCommentary: { status: "running", nodes: [] } })
    const url = new URL(`http://localhost/api/runs/${run.id}`)
    const response = await route({ store, subscriptions, runningRuns, roundContinuations }, new Request(url), url)
    const body = await response.json()
    expect(body.state.reportCommentary.status).toBe("partial")
    runningRuns.add(run.id)
    const post = new URL(`${url}/commentary`)
    expect((await route({ store, subscriptions, runningRuns, roundContinuations }, new Request(post, { method: "POST" }), post)).status).toBe(409)
  } finally { spy.mockRestore(); await rm(root, { recursive: true, force: true }) }
})
