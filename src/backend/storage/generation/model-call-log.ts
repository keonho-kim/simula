/**
 * Purpose: Persist and parse measured calls alongside unmeasured admitted failures.
 * Pattern: Bounded JSONL artifact adapter.
 * Usage: Shared by scenario, world, and analytical report stores.
 * Related: src/shared/model-failure.ts, src/shared/generation-metrics-schema.ts
 */
import { stat, writeFile } from "node:fs/promises"
import type { z } from "zod"
import { modelCallFailureRecordSchema, type ModelCallFailure } from "@/shared/model-failure"

export async function appendModelCallRecord(path: string, value: unknown, maximumBytes: number): Promise<void> {
  const body = `${JSON.stringify(value)}\n`
  if ((await stat(path)).size + Buffer.byteLength(body) > maximumBytes) throw new Error("Model call history exceeded its storage budget.")
  await writeFile(path, body, { flag: "a" })
}

export function parseModelCallLog<T>(body: string, measured: z.ZodType<T>) {
  const metrics: T[] = []
  const failures: Array<{ timestamp: string; failure: ModelCallFailure }> = []
  for (const line of body.split("\n")) {
    if (!line) continue
    const value: unknown = JSON.parse(line)
    if (typeof value === "object" && value !== null && "failure" in value) failures.push(modelCallFailureRecordSchema.parse(value))
    else metrics.push(measured.parse(value))
  }
  return { metrics, failures }
}
