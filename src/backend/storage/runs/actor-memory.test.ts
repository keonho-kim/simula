/**
 * Purpose: Verify retained actor records and their cursor persist with canonical run state.
 * Pattern: Repository contract test.
 * Usage: bun test src/backend/storage/runs/actor-memory.test.ts
 * Related: src/backend/storage/runs/run-store.ts, src/backend/core/simulation/actors/memory-records.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { initialSimulationState } from "@/backend/core/simulation/workflow/state"
import { buildActor } from "@/backend/core/simulation/roles/generator/state"
import { applyMemoryUpdate, parseMemoryUpdate } from "@/backend/core/simulation/actors/memory-records"
import { seedRunState } from "./testing/fixtures"
import { RunStore } from "./run-store"

test("reopening run storage preserves retained quotes, evidence and processed cursor", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "simula-memory-"))
  try {
    const store = new RunStore({ rootDir })
    const scenario = { text: "A release review", controls: { numCast: 1, maxRound: 1, fastMode: false,
      actionsPerType: 1, allowAdditionalCast: false } }
    const run = await store.createRun(scenario)
    const state = initialSimulationState(run.id, scenario)
    const actor = buildActor(1, { name: "Finance", role: "Reviewer", backgroundHistory: "Review", personality: "Practical", preference: "Clarity" }, "Review", {})
    actor.privateGoal = "Only Finance knows the budget concern."
    actor.contextSummary = "A later summary omits the initial concern."
    const entry = { id: "promise", kind: "self" as const, roundIndex: 1, content: "I will deliver the budget tomorrow." }
    const update = parseMemoryUpdate({ additions: [{ kind: "commitment", quote: entry.content }], closures: [] }, entry, [])
    actor.context = { visible: [entry], ledger: applyMemoryUpdate(undefined, entry, update, actor.id) }
    state.actors = [actor]
    await seedRunState(store, state)
    const restored = await new RunStore({ rootDir }).readState(run.id)
    expect(restored?.actors[0]?.context).toEqual(actor.context)
    expect(restored?.actors[0]?.privateGoal).toBe(actor.privateGoal)
    expect(restored?.actors[0]?.contextSummary).not.toContain(actor.privateGoal)
    expect(restored?.actors[0]?.context.ledger?.records[0]?.sourceEntryId).toBe(entry.id)
  } finally { await rm(rootDir, { recursive: true, force: true }) }
})
