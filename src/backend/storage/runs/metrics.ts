/**
 * Purpose: Read run model usage without materializing unrelated simulation history.
 * Pattern: Bounded event-log projection.
 * Usage: Called by RunStore for analytical resource accounting.
 * Related: src/backend/storage/runs/run-store.ts, src/shared/analytical-report.ts
 */
import { createReadStream } from "node:fs"
import { createInterface } from "node:readline"
import { z } from "zod"
import type { UsageMeasure } from "@/shared/analytical-report"
import { modelCallFailureSchema, type ModelCallFailure } from "@/shared/model-failure"

const MAX_METRIC_EVENT_CHARS = 16_000
const MAX_METRIC_CALLS = 100_000
const nonnegative = z.number().finite().nonnegative()
const measure = z.object({ durationMs: nonnegative, queueWaitMs: nonnegative.optional(),
  inputTokens: nonnegative, reasoningTokens: nonnegative, outputTokens: nonnegative,
  totalTokens: nonnegative, tokenSource: z.enum(["provider", "unavailable"]),
})
const event = z.object({ type: z.literal("model.metrics"), runId: z.string(), metrics: measure })
const failureEvent = z.object({ type: z.literal("model.attempt.failed"), runId: z.string(), failure: modelCallFailureSchema })

export async function readRunCallRecords(path: string, runId: string): Promise<{ metrics: UsageMeasure[]; failures: ModelCallFailure[] }> {
  const input = createReadStream(path, { encoding: "utf8" })
  const lines = createInterface({ input, crlfDelay: Infinity })
  const metrics: UsageMeasure[] = []
  const failures: ModelCallFailure[] = []
  try {
    for await (const line of lines) {
      const measured = line.includes('"type":"model.metrics"')
      const failed = line.includes('"type":"model.attempt.failed"')
      if (!measured && !failed) continue
      if (line.length > MAX_METRIC_EVENT_CHARS) throw new Error("Run metric event exceeds its size limit.")
      const recorded = measured ? event.parse(JSON.parse(line)) : failureEvent.parse(JSON.parse(line))
      if (recorded.runId !== runId) throw new Error("Run metric event has a different owner.")
      if (recorded.type === "model.metrics") metrics.push(recorded.metrics)
      else failures.push(recorded.failure)
      if (metrics.length + failures.length > MAX_METRIC_CALLS) throw new Error("Run metric history exceeds its call limit.")
    }
    return { metrics, failures }
  } finally { lines.close(); input.destroy() }
}
