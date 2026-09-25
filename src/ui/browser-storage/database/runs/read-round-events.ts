/**
 * Purpose: Read one round's events in their accepted order.
 * Pattern: Repository Query.
 * Usage: Called by conversation and round-history views.
 * Related: src/ui/browser-storage/database/run-schema.ts, src/ui/browser-storage/database/orm.ts
 */
import type { RunEvent } from "@/shared"
import { and, eq } from "drizzle-orm"
import { browserOrm } from "../orm"
import { runEvents } from "../run-schema"

export async function readRoundEvents(runId: string, roundIndex: number): Promise<RunEvent[]> {
  const rows = await browserOrm.select({ payloadJson: runEvents.payloadJson }).from(runEvents)
    .where(and(eq(runEvents.runId, runId), eq(runEvents.roundIndex, roundIndex)))
    .orderBy(runEvents.sequence)
  return rows.map(row => JSON.parse(row.payloadJson) as RunEvent)
}
