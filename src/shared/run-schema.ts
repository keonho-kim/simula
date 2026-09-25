/**
 * Purpose: Parse portable run identities and manifests at storage and browser boundaries.
 * Pattern: Shared wire schema.
 * Usage: Used by RunStore and prepared-world run responses.
 * Related: src/shared/run.ts, src/backend/storage/runs/run-store.ts
 */
import { z } from "zod"

export const runPathSegmentSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/)
export const runManifestSchema = z.object({
  id: runPathSegmentSchema, status: z.enum(["created", "running", "completed", "failed", "canceled", "interrupted"]),
  usageAccountingVersion: z.literal(1).optional(),
  batchId: z.uuid().optional(),
  createdAt: z.iso.datetime(), startedAt: z.iso.datetime().optional(), completedAt: z.iso.datetime().optional(),
  scenarioName: z.string().optional(), stopReason: z.enum(["", "simulation_done", "no_progress", "failed", "canceled"]).optional(), error: z.string().optional(),
  artifactPaths: z.object({ manifest: z.string(), events: z.string(), state: z.string(), report: z.string(), timeline: z.string() }),
}).strict()
