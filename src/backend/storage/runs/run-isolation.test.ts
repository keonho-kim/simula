/**
 * Purpose: Verify parallel runs cannot share storage and world materialization is idempotent.
 * Pattern: Repository concurrency contract tests.
 * Usage: bun test src/backend/storage/runs/run-isolation.test.ts
 * Related: src/backend/storage/runs/run-store.ts, src/backend/storage/runs/run-id.ts
 */
import { seedRunEvent } from "@/backend/storage/runs/testing/fixtures"
import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { RunStore } from "./run-store"

const scenario = { sourceName: "shared-scenario.md", text: "A team reviews an investment.",
  controls: { numCast: 2, allowAdditionalCast: false, actionsPerType: 1, maxRound: 1, fastMode: false } }

test("fifty same-name runs created together have independent persistent identities", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "simula-world-runs-"))
  try {
    const store = new RunStore({ rootDir })
    const runs = await Promise.all(Array.from({ length: 50 }, () => store.createRun(scenario)))
    expect(new Set(runs.map(run => run.id)).size).toBe(50)
    expect(await store.listRuns()).toHaveLength(50)
    await seedRunEvent(store, { type: "run.started", runId: runs[0].id, timestamp: new Date().toISOString() })
    expect(await store.readEvents(runs[1].id)).toEqual([])
  } finally { await rm(rootDir, { recursive: true, force: true }) }
})

test("a deterministic world run ID reuses only identical input and rejects escaping paths", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "simula-world-idempotent-"))
  try {
    const store = new RunStore({ rootDir })
    const id = `world-${crypto.randomUUID()}`
    const runs = await Promise.all([store.createRun(scenario, { id }), store.createRun(scenario, { id })])
    expect(runs[0].id).toBe(runs[1].id)
    expect(await store.listRuns()).toHaveLength(1)
    await expect(store.createRun({ ...scenario, text: "Different input" }, { id })).rejects.toThrow("different")
    expect(() => store.runDir("../outside")).toThrow()
    expect(() => store.path(id, "../manifest.json")).toThrow()
    await writeFile(store.path(id, "manifest.json"), JSON.stringify({ ...runs[0], id: "another-run" }))
    await expect(store.readManifest(id)).rejects.toThrow("identity")
  } finally { await rm(rootDir, { recursive: true, force: true }) }
})
