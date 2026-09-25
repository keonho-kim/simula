/**
 * Purpose: Read a run detail stored by the former single-artifact format.
 * Pattern: Repository Query.
 * Usage: Called before relational run detail assembly during compatibility reads.
 * Related: src/ui/browser-storage/database/runs/read-detail.ts, src/ui/browser-storage/database/artifact-schema.ts
 */
import { eq } from "drizzle-orm"
import { artifacts } from "../artifact-schema"
import { browserOrm } from "../orm"
import type { BrowserRunDetail } from "./types"

export async function readLegacyRunSnapshot(runId: string): Promise<BrowserRunDetail | undefined> {
  const [row] = await browserOrm.select({ valueJson: artifacts.valueJson }).from(artifacts)
    .where(eq(artifacts.id, `run-detail:${runId}`)).limit(1)
  return row ? JSON.parse(row.valueJson) as BrowserRunDetail : undefined
}
