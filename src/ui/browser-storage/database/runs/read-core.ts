/**
 * Purpose: Read one run manifest with its optional state snapshot.
 * Pattern: Repository Query.
 * Usage: Called by relational run detail assembly.
 * Related: src/ui/browser-storage/database/runs/read-detail.ts, src/ui/browser-storage/database/run-schema.ts
 */
import type { RunManifest, SimulationState } from "@/shared"
import { eq } from "drizzle-orm"
import { browserOrm } from "../orm"
import { runs, runSnapshots } from "../run-schema"

export async function readRunCore(runId: string): Promise<{ run: RunManifest; state?: SimulationState } | undefined> {
  const [row] = await browserOrm.select({ manifestJson: runs.manifestJson, stateJson: runSnapshots.stateJson })
    .from(runs).leftJoin(runSnapshots, eq(runSnapshots.runId, runs.id)).where(eq(runs.id, runId)).limit(1)
  if (!row) return undefined
  return { run: JSON.parse(row.manifestJson) as RunManifest,
    state: row.stateJson ? JSON.parse(row.stateJson) as SimulationState : undefined }
}
