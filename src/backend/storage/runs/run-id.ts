/**
 * Purpose: Generate standalone and deterministic world-run identities and validate path segments.
 * Pattern: Storage identity boundary.
 * Usage: Called by RunStore before resolving run and artifact paths.
 * Related: src/backend/storage/runs/run-store.ts, src/backend/runtime/worlds/preparation.ts
 */
import { runPathSegmentSchema } from "@/shared/run-schema"

export function buildRunId(sourceName?: string): string {
  const stamp = new Date().toISOString().replaceAll(/[-:]/g, "").replace(/\..+$/, "Z")
  const safeName = (sourceName ?? "scenario")
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
  return `${stamp}.${safeName || "scenario"}.${crypto.randomUUID()}`
}

export function buildWorldRunId(worldId: string): string { return `world-${worldId}` }

export function assertRunPathSegment(value: string): void {
  if (!runPathSegmentSchema.safeParse(value).success) throw new Error("Invalid run artifact identifier.")
}
