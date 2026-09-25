/**
 * Purpose: Assemble one browser-owned run from its separate indexed queries.
 * Pattern: Read Model.
 * Usage: Called by history and report fallback when the server is unavailable.
 * Related: src/ui/browser-storage/database/runs/read-core.ts, src/ui/browser-storage/database/runs/read-all-events.ts
 */
import { readAllRunEvents } from "./read-all-events"
import { readRunCore } from "./read-core"
import { readRunFrames } from "./read-frames"
import { readLegacyRunSnapshot } from "./read-legacy-snapshot"
import type { BrowserRunDetail } from "./types"

export async function readBrowserRun(runId: string): Promise<BrowserRunDetail | undefined> {
  const snapshot = await readLegacyRunSnapshot(runId)
  if (snapshot) return snapshot
  const core = await readRunCore(runId)
  if (!core) return undefined
  const [timeline, events] = await Promise.all([readRunFrames(runId), readAllRunEvents(runId)])
  return { ...core, timeline, events }
}
