/**
 * Purpose: Mark a locally active run interrupted when its server owner is gone.
 * Pattern: State Transition.
 * Usage: Called during run-list and report recovery after a server restart.
 * Related: src/ui/browser-storage/database/runs/read-detail.ts, src/ui/browser-storage/database/runs/save-detail.ts
 */
import type { RunManifest } from "@/shared"
import { readBrowserRun } from "./read-detail"
import { saveRunDetail } from "./save-detail"

export async function markRunInterrupted(runId: string): Promise<RunManifest | undefined> {
  const local = await readBrowserRun(runId)
  if (!local || !["created", "running"].includes(local.run.status)) return local?.run
  const run: RunManifest = { ...local.run, status: "interrupted", completedAt: new Date().toISOString(),
    error: "The server stopped before this run completed. Saved browser history is available." }
  await saveRunDetail({ ...local, run })
  return run
}
