/**
 * Purpose: Seed run repository fixtures through the same ownership checks as production writers.
 * Pattern: Test-only repository fixture adapter.
 * Usage: Imported by run, API and report tests that prepare stored artifacts.
 * Related: src/backend/storage/runs/run-store.ts
 */
import type { RunEvent, RunManifest, SimulationState } from "@/shared"
import type { ExecutionLease } from "@/backend/storage/generation/execution-lease"
import type { RunStore } from "../run-store"

export function seedRunManifest(store: RunStore, manifest: RunManifest) {
  return ownFixture(store, manifest.id, lease => store.writeManifest(manifest, lease))
}
export function seedRunState(store: RunStore, state: SimulationState) {
  return ownFixture(store, state.runId, lease => store.writeState(state, lease))
}
export function seedRunEvent(store: RunStore, event: RunEvent) {
  return ownFixture(store, event.runId, lease => store.appendEvent(event, lease))
}

async function ownFixture<T>(store: RunStore, id: string, write: (lease: ExecutionLease) => Promise<T>): Promise<T> {
  const lease = store.execution(id).claim()
  if (!lease) throw new Error("Run fixture is already owned by active work.")
  try { return await write(lease) }
  finally { lease.release() }
}
