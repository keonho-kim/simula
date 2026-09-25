/**
 * Purpose: Verify browser-confirmed active and terminal history releases transfer records.
 * Pattern: Repository contract test.
 * Usage: bun test src/backend/storage/runs/browser-ack.test.ts
 * Related: src/backend/storage/runs/run-store.ts, src/backend/api/routes.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { RunStore } from "./run-store"
import { buildTimelineFrame } from "@/backend/core/simulation/outputs/timeline"
import type { RunEvent } from "@/shared"

test("confirmed event counts prune only matching temporary history", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "simula-ack-test-"))
  try {
    const store = new RunStore({ rootDir })
    const run = await store.createRun({ text: "Two colleagues discuss a release.", controls: {
      numCast: 2, allowAdditionalCast: false, actionsPerType: 1, maxRound: 1, fastMode: false } })
    const first = { type: "run.started", runId: run.id, timestamp: new Date().toISOString() }
    await writeFile(store.path(run.id, "events.jsonl"), `${JSON.stringify(first)}\n`)
    expect(await store.pruneConfirmedEvents(run.id, 0)).toBe(false)
    expect(await store.readEvents(run.id)).toHaveLength(1)
    expect(await store.pruneConfirmedEvents(run.id, 1)).toBe(true)
    expect(await store.readEvents(run.id)).toEqual([])
    const second = { type: "run.completed", runId: run.id, timestamp: new Date().toISOString(), stopReason: "simulation_done" }
    await writeFile(store.path(run.id, "events.jsonl"), `${JSON.stringify(second)}\n`)
    expect(await store.pruneConfirmedEvents(run.id, 2)).toBe(true)
    expect(await store.readEvents(run.id)).toEqual([])
  } finally { await rm(rootDir, { recursive: true, force: true }) }
})

test("active acknowledgements release stream frames without discarding calculation history", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "simula-active-ack-test-"))
  try {
    const store = new RunStore({ rootDir })
    const run = await store.createRun({ text: "Review", controls: {
      numCast: 1, allowAdditionalCast: false, actionsPerType: 1, maxRound: 1, fastMode: false } })
    const lease = store.execution(run.id).claim()
    if (!lease) throw new Error("Missing test run owner.")
    const first = { type: "log" as const, runId: run.id, timestamp: new Date().toISOString(), level: "info" as const, message: "first" }
    await store.appendEvent(first, lease)
    const reader = await store.openEventLog(run.id)
    const cursor = (await reader.next())!.cursor
    expect(store.confirmStreamThrough(run.id, `${run.id}:1`)).toBe(false)
    expect(store.confirmStreamThrough(run.id, cursor)).toBe(true)
    expect(await store.readEvents(run.id)).toEqual([first])
    await expect(store.openEventLog(run.id)).rejects.toThrow("confirmed")
    const resumed = await store.openEventLog(run.id, cursor)
    const second = { ...first, message: "second" }
    await store.appendEvent(second, lease)
    expect((await resumed.next())?.event).toEqual(second)
    await reader.close(); await resumed.close(); lease.release()
  } finally { await rm(rootDir, { recursive: true, force: true }) }
})

test("round projection remains complete after the browser confirms and prunes earlier events", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "simula-pruned-timeline-"))
  try {
    const store = new RunStore({ rootDir })
    const run = await store.createRun({ text: "Review", controls: {
      numCast: 2, allowAdditionalCast: false, actionsPerType: 1, maxRound: 1, fastMode: false } })
    const lease = store.execution(run.id).claim()
    if (!lease) throw new Error("Missing test run owner.")
    const timestamp = "2026-09-25T00:00:00.000Z"
    const events: RunEvent[] = [
      { type: "actors.ready", runId: run.id, timestamp, actors: [
        { id: "a", label: "A", role: "Lead", intent: "Act", interactionCount: 0 },
        { id: "b", label: "B", role: "Peer", intent: "React", interactionCount: 0 },
      ] },
      { type: "interaction.recorded", runId: run.id, timestamp, interaction: {
        id: "i1", roundIndex: 1, sourceActorId: "a", targetActorIds: ["b"],
        actionType: "ask", content: "A asks B", eventId: "e1", visibility: "public",
        decisionType: "action", intent: "Ask", expectation: "Answer",
      } },
      { type: "round.completed", runId: run.id, timestamp, roundIndex: 1 },
    ]
    for (const event of events.slice(0, 2)) await store.appendEvent(event, lease)
    expect(await store.pruneConfirmedEvents(run.id, 2)).toBe(true)
    const actual = await store.appendEvent(events[2]!, lease)
    expect(actual).toEqual(buildTimelineFrame(2, events[2]!, undefined, events))
    lease.release()
  } finally { await rm(rootDir, { recursive: true, force: true }) }
})
