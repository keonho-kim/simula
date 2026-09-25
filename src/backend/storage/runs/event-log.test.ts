/**
 * Purpose: Verify bounded event replay resumes at complete, run-scoped log boundaries.
 * Pattern: Storage contract tests.
 * Usage: bun test src/backend/storage/runs/event-log.test.ts
 * Related: src/backend/storage/runs/event-log.ts
 */
import { expect, test } from "bun:test"
import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { RunEventLog } from "./event-log"
import type { RunEvent } from "@/shared/run"
import { MAX_RUN_EVENT_BYTES } from "@/shared/run-stream"

test("replay resumes after complete UTF-8 records and leaves an unfinished append unread", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-event-replay-"))
  const path = join(root, "events.jsonl")
  const first = { type: "log", runId: "run", timestamp: new Date().toISOString(), level: "info", message: "한국어" } satisfies RunEvent
  const second = { ...first, message: "next" }
  try {
    await writeFile(path, `${JSON.stringify(first)}\n${JSON.stringify(second).slice(0, -1)}`)
    const reader = await RunEventLog.open(path, "run")
    try {
      const one = await reader.next()
      expect(one?.event).toEqual(first)
      expect(await reader.next()).toBeUndefined()
      await appendFile(path, "}\n")
      expect((await reader.next())?.event).toEqual(second)
      const resumed = await RunEventLog.open(path, "run", one?.cursor)
      try { expect((await resumed.next())?.event).toEqual(second); expect(await resumed.next()).toBeUndefined() }
      finally { await resumed.close() }
    } finally { await reader.close() }
    await expect(RunEventLog.open(path, "run", "other:0")).rejects.toThrow("cursor")
    await expect(RunEventLog.open(path, "run", "run:1")).rejects.toThrow("boundary")
    await expect(RunEventLog.open(path, "run", "run:9999999")).rejects.toThrow("cursor")
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("wrong-run and malformed committed records fail explicitly rather than disappearing", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-event-invalid-"))
  const path = join(root, "events.jsonl")
  try {
    await writeFile(path, JSON.stringify({ type: "run.started", runId: "other", timestamp: new Date().toISOString() }) + "\n")
    const reader = await RunEventLog.open(path, "run")
    try { await expect(reader.next()).rejects.toThrow("scope") } finally { await reader.close() }
    await writeFile(path, "invalid\n")
    const invalid = await RunEventLog.open(path, "run")
    try { await expect(invalid.next()).rejects.toThrow() } finally { await invalid.close() }
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("an oversized unfinished record is bounded instead of buffering the entire log", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-event-limit-"))
  const path = join(root, "events.jsonl")
  try {
    await writeFile(path, "x".repeat(MAX_RUN_EVENT_BYTES + 1))
    const reader = await RunEventLog.open(path, "run")
    try { await expect(reader.next()).rejects.toThrow("size limit") } finally { await reader.close() }
  } finally { await rm(root, { recursive: true, force: true }) }
})
