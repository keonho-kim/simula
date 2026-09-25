/**
 * Purpose: Read the highest persisted event sequence for one execution.
 * Pattern: Repository Query.
 * Usage: Called before stream reconnection to resume after committed events.
 * Related: src/ui/browser-storage/database/run-schema.ts, src/ui/hooks/use-run-event-stream.ts
 */
import { desc, eq } from "drizzle-orm"
import { browserOrm } from "../orm"
import { runEvents } from "../run-schema"

export async function lastRunEventSequence(runId: string): Promise<number> {
  const [row] = await browserOrm.select({ sequence: runEvents.sequence }).from(runEvents)
    .where(eq(runEvents.executionId, runId)).orderBy(desc(runEvents.sequence)).limit(1)
  return row?.sequence ?? 0
}
