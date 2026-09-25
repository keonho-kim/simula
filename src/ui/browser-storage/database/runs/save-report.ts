/**
 * Purpose: Upsert a completed run's Markdown report.
 * Pattern: Repository Query.
 * Usage: Called when a report response is persisted in browser storage.
 * Related: src/ui/browser-storage/database/run-schema.ts, src/ui/api-client/client.ts
 */
import { browserOrm } from "../orm"
import { runReports } from "../run-schema"

export async function saveRunReport(runId: string, markdown: string): Promise<void> {
  await browserOrm.insert(runReports).values({ runId, reportMd: markdown })
    .onConflictDoUpdate({ target: runReports.runId, set: { reportMd: markdown } }).run()
}
