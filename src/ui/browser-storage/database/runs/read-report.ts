/**
 * Purpose: Read a persisted run report without loading its full history.
 * Pattern: Repository Query.
 * Usage: Called by report retrieval and offline fallback.
 * Related: src/ui/browser-storage/database/run-schema.ts, src/ui/api-client/client.ts
 */
import { eq } from "drizzle-orm"
import { browserOrm } from "../orm"
import { runReports } from "../run-schema"

export async function readRunReport(runId: string): Promise<string | undefined> {
  const [row] = await browserOrm.select({ reportMd: runReports.reportMd }).from(runReports)
    .where(eq(runReports.runId, runId)).limit(1)
  return row?.reportMd
}
