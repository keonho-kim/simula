/**
 * Purpose: Verify shared scenario model calls survive storage reopening without world ownership.
 * Pattern: Repository contract test.
 * Usage: bun test src/backend/storage/scenario-builder/build-store.test.ts
 * Related: src/backend/storage/scenario-builder/build-store.ts, src/shared/generation-metrics-schema.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { parseBuilderRequest } from "@/backend/core/scenario-builder/contracts"
import { ScenarioBuildStore } from "./build-store"

test("shared scenario calls persist once across retries and reopening", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-shared-metrics-"))
  try {
    const store = new ScenarioBuildStore(root)
    const id = crypto.randomUUID()
    await store.create(id, parseBuilderRequest({ documentSetId: crypto.randomUUID(), documentRevision: 1, language: "en", fastMode: false }))
    const call = { role: "storyBuilder" as const, step: "draft" as const, attempt: 1, ttftMs: 10, durationMs: 30,
      inputTokens: 20, reasoningTokens: 0, outputTokens: 5, totalTokens: 25, tokenSource: "provider" as const }
    await store.appendMetrics(id, call)
    await store.appendMetrics(id, { ...call, attempt: 2, tokenSource: "unavailable",
      inputTokens: 0, outputTokens: 0, totalTokens: 0 })
    await store.appendFailure(id, { role: "storyBuilder", step: "draft", attempt: 3, outcome: "failed", queueWaitMs: 2 })
    const recorded = await new ScenarioBuildStore(root).readMetrics(id)
    expect(recorded).toHaveLength(2)
    expect(recorded?.map(value => value.metrics.attempt)).toEqual([1, 2])
    expect(recorded?.[1]?.metrics.tokenSource).toBe("unavailable")
    expect(await new ScenarioBuildStore(root).readFailures(id)).toMatchObject([{ failure: { attempt: 3, outcome: "failed" } }])
  } finally { await rm(root, { recursive: true, force: true }) }
})
