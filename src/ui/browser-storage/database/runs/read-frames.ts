/**
 * Purpose: Read one run's graph frames in frame order.
 * Pattern: Repository Query.
 * Usage: Called by relational run detail assembly.
 * Related: src/ui/browser-storage/database/runs/read-detail.ts, src/ui/browser-storage/database/run-schema.ts
 */
import type { GraphTimelineFrame } from "@/shared"
import { eq } from "drizzle-orm"
import { browserOrm } from "../orm"
import { graphFrames } from "../run-schema"

export async function readRunFrames(runId: string): Promise<GraphTimelineFrame[]> {
  const rows = await browserOrm.select({ payloadJson: graphFrames.payloadJson }).from(graphFrames)
    .where(eq(graphFrames.runId, runId)).orderBy(graphFrames.frameIndex)
  return rows.map(row => JSON.parse(row.payloadJson) as GraphTimelineFrame)
}
