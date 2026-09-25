/**
 * Purpose: Verify simulation exclusion, remote cancellation of round waits, and displaced writer isolation.
 * Pattern: Runtime concurrency tests with controlled simulation work.
 * Usage: bun test src/backend/runtime/run-ownership.test.ts
 * Related: src/backend/runtime/execute-run.ts, src/backend/runtime/run-ownership.ts
 */
import { expect, spyOn, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as workflow from "@/backend/core/simulation/workflow/graph"
import { initialSimulationState } from "@/backend/core/simulation/workflow/state"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { ExecutionOwnership } from "@/backend/storage/generation/execution-lease"
import { RunStore } from "@/backend/storage/runs/run-store"
import { cancelRun, continueRunRound, startRun, startReportCommentary } from "@/backend/api/runs/run-controller"
import { ModelAdmission } from "./model-admission"
import { RoundContinuationStore } from "./round-continuation"
import { Subscriptions } from "./events"
import { executeRun } from "./execute-run"

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "simula-running-owner-"))
  const store = new RunStore({ rootDir: root })
  const scenario = { text: "Review investment.", controls: { numCast: 1, maxRound: 1, actionsPerType: 1, fastMode: false, allowAdditionalCast: false } }
  const run = await store.createRun(scenario)
  const continuations = new RoundContinuationStore(), subscriptions = new Subscriptions(), running = new Set([run.id])
  const admission = new ModelAdmission({ concurrency: 1 })
  const execute = () => executeRun(store, subscriptions, running, continuations, run, scenario, defaultSettings(), admission, { commentary: "defer" })
  return { root, store, scenario, run, continuations, subscriptions, running, admission, execute,
    close: () => rm(root, { recursive: true, force: true }) }
}

test("another controller cannot start a simulation or legacy commentary while a durable owner is active", async () => {
  const f = await fixture()
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  const graph = spyOn(workflow, "runSimulation").mockImplementation(async () => {
    entered.resolve(); await release.promise
    return { ...initialSimulationState(f.run.id, f.scenario), reportMarkdown: "Accepted report" }
  })
  let work: Promise<void> | undefined
  try {
    work = f.execute(); await entered.promise
    const remoteStore = new RunStore({ rootDir: f.root }), remoteRuns = new Set<string>(), remoteRounds = new RoundContinuationStore()
    const response = await startRun(remoteStore, new Subscriptions(), remoteRuns, remoteRounds, f.run.id, f.admission, async () => { throw new Error("Duplicate request read model settings") })
    expect(await response.json()).toEqual({ status: "already_running" })
    expect((await startReportCommentary(remoteStore, new Subscriptions(), remoteRuns, remoteRounds, f.run.id, f.admission)).status).toBe(409)
    expect(graph).toHaveBeenCalledTimes(1)
    release.resolve(); await work
    expect((await f.store.readManifest(f.run.id)).status).toBe("completed")
    expect(f.store.execution(f.run.id).isActive()).toBe(false)
  } finally { release.resolve(); await work; graph.mockRestore(); await f.close() }
})

test("durable cancellation wakes an owner's manual round wait without another approval", async () => {
  const f = await fixture()
  const waiting = Promise.withResolvers<void>()
  const graph = spyOn(workflow, "runSimulation").mockImplementation(async input => {
    waiting.resolve()
    await input.waitForNextRound?.(1)
    throw new Error("A canceled round must not proceed")
  })
  let work: Promise<void> | undefined
  try {
    work = f.execute(); await waiting.promise
    expect(cancelRun(new RunStore({ rootDir: f.root }), new Set(), new RoundContinuationStore(), f.run.id).status).toBe(202)
    await work
    expect((await f.store.readManifest(f.run.id)).status).toBe("canceled")
    expect((await f.store.readEvents(f.run.id)).filter(event => event.type === "run.canceled")).toHaveLength(1)
    expect((await f.store.readEvents(f.run.id)).some(event => event.type === "run.failed")).toBe(false)
    expect(f.running.size).toBe(0)
  } finally { f.continuations.cancel(f.run.id); await work; graph.mockRestore(); await f.close() }
}, 10_000)

test("a displaced simulation cannot publish its late result over a successor", async () => {
  const f = await fixture()
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  const graph = spyOn(workflow, "runSimulation").mockImplementation(async () => {
    entered.resolve(); await release.promise
    return { ...initialSimulationState(f.run.id, f.scenario), reportMarkdown: "Late result" }
  })
  let work: Promise<void> | undefined
  try {
    work = f.execute(); await entered.promise
    const current = new ExecutionOwnership(f.store.runDir(f.run.id), () => Date.now() + 60_000).claim()
    if (!current) throw new Error("Missing successor")
    await f.store.writeState({ ...initialSimulationState(f.run.id, f.scenario), reportMarkdown: "Successor result" }, current)
    await f.store.writeManifest({ ...f.run, status: "failed", error: "Successor owns this run" }, current)
    release.resolve(); await work
    expect(await f.store.readReport(f.run.id)).toBe("Successor result")
    expect((await f.store.readManifest(f.run.id)).error).toBe("Successor owns this run")
    expect(await f.store.readEvents(f.run.id)).toEqual([])
    expect(f.store.execution(f.run.id).isActive()).toBe(true)
    expect(current.renew()).toBe(true)
    current.release()
  } finally { release.resolve(); await work; graph.mockRestore(); await f.close() }
})

test("remote approval during round completion publication is retained until wait registration", async () => {
  const f = await fixture()
  const remote = new RunStore({ rootDir: f.root }), remoteRounds = new RoundContinuationStore()
  const graph = spyOn(workflow, "runSimulation").mockImplementation(async input => {
    expect(continueRunRound(remote, remoteRounds, f.run.id, 1).status).toBe(409)
    await input.emit({ type: "round.completed", runId: f.run.id, timestamp: new Date().toISOString(), roundIndex: 1, awaitsContinuation: true })
    await input.waitForNextRound?.(1)
    await input.emit({ type: "round.completed", runId: f.run.id, timestamp: new Date().toISOString(), roundIndex: 2, awaitsContinuation: false })
    expect(continueRunRound(remote, remoteRounds, f.run.id, 2).status).toBe(409)
    return initialSimulationState(f.run.id, f.scenario)
  })
  try {
    await executeRun(f.store, f.subscriptions, f.running, f.continuations, f.run, f.scenario, defaultSettings(), f.admission, {
      commentary: "defer",
      onEvent: async event => {
        if (event.type !== "round.completed" || !event.awaitsContinuation) return
        expect(continueRunRound(remote, remoteRounds, f.run.id, 2).status).toBe(409)
        expect(continueRunRound(remote, remoteRounds, f.run.id, 1).status).toBe(200)
      },
    })
    expect((await f.store.readManifest(f.run.id)).status).toBe("completed")
    expect(continueRunRound(remote, remoteRounds, f.run.id, 1).status).toBe(409)
  } finally { graph.mockRestore(); await f.close() }
})
