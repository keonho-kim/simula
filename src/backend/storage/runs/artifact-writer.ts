/**
 * Purpose: Prepare run artifacts asynchronously and publish them under the current execution owner.
 * Pattern: Fenced atomic file writer.
 * Usage: RunStore uses this for manifests, state, Markdown and timeline snapshots.
 * Related: src/backend/storage/runs/run-store.ts, src/backend/storage/generation/execution-lease.ts
 */
import { rm, writeFile } from "node:fs/promises"
import type { ExecutionLease } from "@/backend/storage/generation/execution-lease"

export async function writeRunArtifact(target: string, body: string, lease: ExecutionLease, allowCanceled = false): Promise<void> {
  const temporary = `${target}.${crypto.randomUUID()}.tmp`
  try {
    await writeFile(temporary, body, { flag: "wx" })
    lease.publish(temporary, target, allowCanceled)
  } finally { await rm(temporary, { force: true }) }
}
