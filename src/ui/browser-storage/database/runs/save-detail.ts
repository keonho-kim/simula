/**
 * Purpose: Commit one run's final manifest, state, frames, and events atomically.
 * Pattern: Repository Transaction.
 * Usage: Called after a complete server run detail is received.
 * Related: src/ui/browser-storage/database/runs/types.ts, src/ui/browser-storage/database/run-schema.ts
 */
import { eq } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import { artifacts } from "../artifact-schema"
import { browserOrm } from "../orm"
import { graphFrames, runEvents, runs, runSnapshots } from "../run-schema"
import { eventRoundIndex } from "./event-round-index"
import type { BrowserRunDetail } from "./types"

export async function saveRunDetail(detail: BrowserRunDetail): Promise<void> {
  const { run, state, timeline } = detail
  const manifestJson = JSON.stringify(run)
  const statements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [browserOrm.insert(runs)
    .values({ id: run.id, scenarioId: null, status: run.status, createdAt: run.createdAt, manifestJson })
    .onConflictDoUpdate({ target: runs.id, set: { status: run.status, manifestJson } }),
  state ? browserOrm.insert(runSnapshots).values({ runId: run.id, stateJson: JSON.stringify(state) })
    .onConflictDoUpdate({ target: runSnapshots.runId, set: { stateJson: JSON.stringify(state) } })
    : browserOrm.delete(runSnapshots).where(eq(runSnapshots.runId, run.id)),
  browserOrm.delete(artifacts).where(eq(artifacts.id, `run-detail:${run.id}`)),
  ...timeline.map(frame => browserOrm.insert(graphFrames).values({ runId: run.id, frameIndex: frame.index,
    payloadJson: JSON.stringify(frame) }).onConflictDoUpdate({ target: [graphFrames.runId, graphFrames.frameIndex],
    set: { payloadJson: JSON.stringify(frame) } }))]
  if (["completed", "failed", "canceled", "interrupted"].includes(run.status)) {
    statements.push(browserOrm.delete(runEvents).where(eq(runEvents.runId, run.id)))
    statements.push(...detail.events.map((event, index) => browserOrm.insert(runEvents).values({
      executionId: run.id, sequence: index + 1, runId: run.id, roundIndex: eventRoundIndex(event),
      kind: event.type, payloadJson: JSON.stringify(event),
    })))
  }
  await browserOrm.batch(statements)
}
