/**
 * Purpose: Prepare isolated world lifecycle fixtures with deterministic model responses.
 * Pattern: Integration test fixture.
 * Usage: Imported by world ownership and handoff tests.
 * Related: src/backend/runtime/worlds/preparation.ts, src/backend/core/story-builder/world/test-fixtures.ts
 */
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ScenarioBuildStore } from "@/backend/storage/scenario-builder/build-store"
import { WorldStore } from "@/backend/storage/worlds/world-store"
import { RunStore } from "@/backend/storage/runs/run-store"
import { parseBuilderRequest } from "@/backend/core/scenario-builder/contracts"
import { specification, dependencies } from "@/backend/core/story-builder/world/test-fixtures"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { worldPreparationRequestSchema } from "@/shared/world-preparation-schema"
import { ModelAdmission } from "../../model-admission"
import { WorldPreparationJobs } from "../preparation"

export async function worldFixture(hold = false) {
  const root = await mkdtemp(join(tmpdir(), "simula-world-owner-"))
  const scenarios = new ScenarioBuildStore(join(root, "scenarios"))
  const source = await scenarios.create(specification.id, parseBuilderRequest({ documentSetId: specification.documentSetId, documentRevision: specification.documentRevision }))
  const sourceLease = scenarios.execution(source.id).claim()
  if (!sourceLease) throw new Error("Missing scenario fixture ownership")
  try { await scenarios.write({ ...source, status: "confirmed", specification }, sourceLease) }
  finally { sourceLease.release() }
  const store = new WorldStore(join(root, "worlds"))
  const runs = new RunStore({ rootDir: join(root, "runs") })
  const settings = defaultSettings(); settings.roles.storyBuilder.provider = "lmstudio"
  const model = dependencies()
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  const id = crypto.randomUUID()
  const record = await store.create(id, worldPreparationRequestSchema.parse({ scenarioId: specification.id, controls: { maxRound: 1, actionsPerType: 1, fastMode: false } }), specification.version)
  let calls = 0
  const createJobs = (runStore = runs) => new WorldPreparationJobs(new WorldStore(store.rootDir), scenarios, runStore,
    async () => settings, new ModelAdmission({ concurrency: 4 }), () => async call => {
      calls++; entered.resolve(); if (hold) await release.promise
      return model.deps.invoke(call)
    })
  return { root, store, runs, id, record, createJobs, entered, release, calls: () => calls,
    close: () => rm(root, { recursive: true, force: true }) }
}
