/**
 * Purpose: Upsert one run manifest in the browser's run index.
 * Pattern: Repository Query.
 * Usage: Called when a run is created or its status changes.
 * Related: src/ui/browser-storage/database/run-schema.ts, src/ui/browser-storage/database/orm.ts
 */
import type { RunManifest } from "@/shared"
import { browserOrm } from "../orm"
import { runs } from "../run-schema"

export async function saveRunManifest(run: RunManifest): Promise<void> {
  const manifestJson = JSON.stringify(run)
  await browserOrm.insert(runs).values({ id: run.id, scenarioId: null, status: run.status,
    createdAt: run.createdAt, manifestJson }).onConflictDoUpdate({ target: runs.id,
      set: { status: run.status, manifestJson } }).run()
}
