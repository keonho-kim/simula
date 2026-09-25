/**
 * Purpose: Verify world preparation, independent persistence, and idempotent run/usage handoff.
 * Pattern: API and runtime integration tests.
 * Usage: bun test src/backend/api/worlds/world-controller.test.ts
 * Related: src/backend/api/worlds/world-controller.ts, src/backend/runtime/worlds/preparation.ts
 */
import { ModelAdmission } from "@/backend/runtime/model-admission"
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ScenarioBuildStore } from "@/backend/storage/scenario-builder/build-store"
import { WorldStore } from "@/backend/storage/worlds/world-store"
import { RunStore } from "@/backend/storage/runs/run-store"
import { WorldPreparationJobs } from "@/backend/runtime/worlds/preparation"
import { parseBuilderRequest } from "@/backend/core/scenario-builder/contracts"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { specification, dependencies } from "@/backend/core/story-builder/world/test-fixtures"
import { routeWorlds } from "./world-controller"

test("a confirmed scenario prepares once and materializes one run including preparation metrics", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-world-api-"))
  try {
    const scenarios = new ScenarioBuildStore(join(root, "scenarios"))
    const source = await scenarios.create(specification.id, parseBuilderRequest({ documentSetId: specification.documentSetId, documentRevision: specification.documentRevision }))
    const lease = scenarios.execution(source.id).claim()
    if (!lease) throw new Error("Cannot prepare the test scenario")
    try { await scenarios.write({ ...source, status: "confirmed", specification }, lease) }
    finally { lease.release() }
    const worlds = new WorldStore(join(root, "worlds"))
    const runs = new RunStore({ rootDir: join(root, "runs") })
    const settings = defaultSettings(); settings.roles.storyBuilder.provider = "lmstudio"
    const fixture = dependencies()
    const jobs = new WorldPreparationJobs(worlds, scenarios, runs, async () => settings, new ModelAdmission({ concurrency: 8 }), () => async call => ({
      ...await fixture.deps.invoke(call), metrics: { role: "storyBuilder", step: "draft", attempt: call.attempt, ttftMs: 10, durationMs: 30, queueWaitMs: 15,
        inputTokens: 5, reasoningTokens: 0, outputTokens: 3, totalTokens: 8, tokenSource: "provider" },
    }))
    const id = crypto.randomUUID()
    const post = () => new Request("http://localhost/api/worlds", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": id },
      body: JSON.stringify({ scenarioId: source.id, controls: { maxRound: 1, actionsPerType: 1, fastMode: true } }) })
    expect((await routeWorlds(jobs, post(), new URL(post().url))).status).toBe(202)
    await jobs.start(id).completion
    expect((await worlds.read(id)).status).toBe("ready")
    const ready = await worlds.read(id)
    if (!ready.story) throw new Error("Fixture world did not prepare")
    const checkLease = worlds.execution(id).claim()
    if (!checkLease) throw new Error("Missing test ownership")
    try {
      await expect(worlds.write({ ...ready, story: { ...ready.story, id: crypto.randomUUID() } }, checkLease)).rejects.toThrow("identity")
      await expect(worlds.write({ ...ready, story: undefined }, checkLease)).rejects.toThrow("story")
    } finally { checkLease.release() }
    const calls = fixture.calls.length
    expect((await routeWorlds(jobs, post(), new URL(post().url))).status).toBe(200)
    expect(fixture.calls.length).toBe(calls)
    const [first, second] = await Promise.all([jobs.materializeRun(id), jobs.materializeRun(id)])
    expect(first.id).toBe(second.id)
    expect(await runs.listRuns()).toHaveLength(1)
    const scenario = await runs.readScenario(first.id)
    expect(scenario.world?.participants[0].name).toBe("CTO")
    expect(scenario.world?.participants[0].personality).toBe("Requires evidence.")
    expect(await runs.readEvents(first.id)).toHaveLength(calls)
    // Recover a crash after atomic run creation but before the world manifest acquired its run ID.
    const record = await worlds.read(id)
    const restoreLease = worlds.execution(id).claim()
    if (!restoreLease) throw new Error("Missing test ownership")
    try { await worlds.write({ ...record, runId: undefined }, restoreLease) }
    finally { restoreLease.release() }
    expect((await jobs.materializeRun(id)).id).toBe(first.id)
    expect(await runs.readEvents(first.id)).toHaveLength(calls)
    const persisted = new WorldStore(join(root, "worlds"))
    expect((await persisted.read(id)).runId).toBe(first.id)
  } finally { await rm(root, { recursive: true, force: true }) }
})
