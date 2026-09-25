/**
 * Purpose: Verify run history and final artifacts reject stale execution owners.
 * Pattern: Repository fencing tests.
 * Usage: bun test src/backend/storage/runs/ownership.test.ts
 * Related: src/backend/storage/runs/run-store.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { RunStore } from "./run-store"
import { ExecutionOwnership } from "../generation/execution-lease"
import { initialSimulationState } from "@/backend/core/simulation/workflow/state"

test("a displaced run writer cannot append events or replace state, report or manifest", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-run-fence-"))
  try {
    const store = new RunStore({ rootDir: root })
    const scenario = { text: "Review", controls: { numCast: 1, maxRound: 1, actionsPerType: 1, fastMode: false, allowAdditionalCast: false } }
    const run = await store.createRun(scenario)
    const old = new ExecutionOwnership(store.runDir(run.id)).claim()
    if (!old) throw new Error("Missing owner")
    const current = new ExecutionOwnership(store.runDir(run.id), () => old.expiresAt + 1).claim()
    if (!current) throw new Error("Missing replacement")
    const state = { ...initialSimulationState(run.id, scenario), reportMarkdown: "Accepted report" }
    await store.writeState(state, current)
    await store.writeManifest({ ...run, status: "completed" }, current)
    await expect(store.appendEvent({ type: "run.failed", runId: run.id, timestamp: new Date().toISOString(), error: "Stale" }, old)).rejects.toThrow("ownership")
    await expect(store.writeState({ ...state, reportMarkdown: "Stale report" }, old)).rejects.toThrow("ownership")
    await expect(store.writeManifest({ ...run, status: "failed" }, old)).rejects.toThrow("ownership")
    expect(await store.readEvents(run.id)).toEqual([])
    expect((await store.readState(run.id))?.reportMarkdown).toBe("Accepted report")
    expect(await store.readReport(run.id)).toBe("Accepted report")
    expect((await store.readManifest(run.id)).status).toBe("completed")
    old.release(); current.release()
  } finally { await rm(root, { recursive: true, force: true }) }
})
