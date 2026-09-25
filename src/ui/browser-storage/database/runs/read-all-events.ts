/**
 * Purpose: Read one run's complete event history in sequence order.
 * Pattern: Repository Query.
 * Usage: Called by relational run detail assembly.
 * Related: src/ui/browser-storage/database/runs/read-detail.ts, src/ui/browser-storage/database/run-schema.ts
 */
import type { RunEvent } from "@/shared"
import { eq } from "drizzle-orm"
import { browserOrm } from "../orm"
import { runEvents } from "../run-schema"

export async function readAllRunEvents(runId: string): Promise<RunEvent[]> {
  const rows = await browserOrm.select({ payloadJson: runEvents.payloadJson }).from(runEvents)
    .where(eq(runEvents.runId, runId)).orderBy(runEvents.sequence)
  return rows.map(row => JSON.parse(row.payloadJson) as RunEvent)
}
