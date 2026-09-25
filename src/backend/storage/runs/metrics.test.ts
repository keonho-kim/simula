/**
 * Purpose: Verify run usage can be read without loading unrelated history events.
 * Pattern: Storage reader contract test.
 * Usage: bun test src/backend/storage/runs/metrics.test.ts
 * Related: src/backend/storage/runs/metrics.ts, src/backend/storage/runs/run-store.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readRunCallRecords } from "./metrics"

test("reads only owned metric events from a mixed run history", async () => {
  const directory = await mkdtemp(join(tmpdir(), "simula-run-metrics-"))
  try {
    const path = join(directory, "events.jsonl")
    const metric = { type: "model.metrics", runId: "run-one", timestamp: "2026-09-23T10:00:00Z", metrics: {
      role: "actor", step: "message", attempt: 1, ttftMs: 5, durationMs: 20, queueWaitMs: 3,
      inputTokens: 10, reasoningTokens: 0, outputTokens: 5, totalTokens: 15, tokenSource: "provider",
    } }
    await writeFile(path, [JSON.stringify({ type: "model.message", runId: "run-one", content: "x".repeat(50_000) }),
      JSON.stringify(metric), JSON.stringify({ ...metric, runId: "another-run" })].join("\n") + "\n")
    await expect(readRunCallRecords(path, "run-one")).rejects.toThrow("owner")
    const failure = { type: "model.attempt.failed", runId: "run-one", timestamp: "2026-09-23T10:01:00Z",
      failure: { role: "actor", step: "message", attempt: 2, outcome: "failed", queueWaitMs: 1 } }
    await writeFile(path, `${JSON.stringify(metric)}\n${JSON.stringify(failure)}\n`)
    const calls = await readRunCallRecords(path, "run-one")
    expect(calls.metrics).toHaveLength(1)
    expect(calls.metrics[0]).toMatchObject({ durationMs: 20, inputTokens: 10, totalTokens: 15, tokenSource: "provider" })
    expect(calls.failures).toMatchObject([{ attempt: 2, outcome: "failed" }])
  } finally { await rm(directory, { recursive: true, force: true }) }
})
