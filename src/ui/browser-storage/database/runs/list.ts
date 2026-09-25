/**
 * Purpose: Read recent run manifests from the browser's run index.
 * Pattern: Repository Query.
 * Usage: Called by the landing history and run-status refresh.
 * Related: src/ui/browser-storage/database/run-schema.ts, src/ui/api-client/client.ts
 */
import type { RunManifest } from "@/shared"
import { desc } from "drizzle-orm"
import { browserOrm } from "../orm"
import { runs } from "../run-schema"

export async function listBrowserRuns(): Promise<RunManifest[]> {
  const rows = await browserOrm.select({ manifestJson: runs.manifestJson }).from(runs)
    .orderBy(desc(runs.createdAt), desc(runs.id))
  return rows.map(row => JSON.parse(row.manifestJson) as RunManifest)
}
