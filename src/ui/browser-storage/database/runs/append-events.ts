/**
 * Purpose: Append deduplicated stream events only while their run remains active.
 * Pattern: Repository Query.
 * Usage: Called by the run event stream after a browser batch is received.
 * Related: src/ui/browser-storage/database/runs/event-round-index.ts, src/ui/browser-storage/database/run-schema.ts
 */
import type { RunEvent } from "@/shared"
import { and, eq, notInArray, sql } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import { browserOrm } from "../orm"
import { runEvents, runs } from "../run-schema"
import { eventRoundIndex } from "./event-round-index"

export async function appendRunEvents(runId: string, events: ReadonlyArray<{ sequence: number; event: RunEvent }>): Promise<void> {
  const [first, ...remaining] = events
  if (!first) return
  const insert = ({ sequence, event }: { sequence: number; event: RunEvent }) => browserOrm.insert(runEvents)
    .select(browserOrm.select({
      executionId: sql<string>`${runId}`.as("execution_id"),
      sequence: sql<number>`${sequence}`.as("sequence"),
      runId: runs.id,
      roundIndex: sql<number | null>`${eventRoundIndex(event)}`.as("round_index"),
      kind: sql<string>`${event.type}`.as("kind"),
      payloadJson: sql<string>`${JSON.stringify(event)}`.as("payload_json"),
    }).from(runs).where(and(eq(runs.id, runId),
      notInArray(runs.status, ["completed", "failed", "canceled", "interrupted"]))))
    .onConflictDoNothing()
  const statements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [insert(first), ...remaining.map(insert)]
  await browserOrm.batch(statements)
}
