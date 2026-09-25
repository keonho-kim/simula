/**
 * Purpose: Parse batch requests and persisted world ownership without platform dependencies.
 * Pattern: Shared boundary schema.
 * Usage: Used by Multiverse HTTP, storage, and browser adapters.
 * Related: src/shared/multiverse.ts, src/shared/world-preparation-schema.ts
 */
import { z } from "zod"
import { worldControlsSchema } from "./world-preparation-schema"
import { AUTOMATIC_ROUND_DELAY_COUNT, DEFAULT_BATCH_MINUTES, DEFAULT_BATCH_WORLDS, MAX_BATCH_MINUTES, MAX_BATCH_WORLDS } from "./multiverse"

export const multiverseRequestSchema = z.object({
  scenarioId: z.uuid(), controls: worldControlsSchema,
  worldCount: z.number().int().min(1).max(MAX_BATCH_WORLDS).default(DEFAULT_BATCH_WORLDS),
  autoContinue: z.boolean().default(true),
  maxDurationMinutes: z.number().int().min(1).max(MAX_BATCH_MINUTES).default(DEFAULT_BATCH_MINUTES),
}).strict()

export const batchWorldSchema = z.object({
  id: z.uuid(), index: z.number().int().min(1).max(MAX_BATCH_WORLDS),
  status: z.enum(["pending", "preparing", "running", "waiting", "completed", "failed", "canceled", "interrupted"]),
  autoContinue: z.boolean(), runId: z.string().optional(), roundIndex: z.number().int().positive().optional(),
  automaticStreak: z.number().int().min(0).max(AUTOMATIC_ROUND_DELAY_COUNT), continueAt: z.iso.datetime().optional(), issue: z.string().max(1000).optional(),
}).strict().refine(world => !world.runId || world.runId === `world-${world.id}`, "World run must belong to its batch world.")

export const multiverseRecordSchema = z.object({
  id: z.uuid(), request: multiverseRequestSchema, sourceScenarioVersion: z.number().int().positive(),
  createdAt: z.iso.datetime(), deadlineAt: z.iso.datetime(), revision: z.number().int().positive(),
  status: z.enum(["running", "completed", "partial", "canceled", "interrupted"]), stopReason: z.enum(["user", "deadline"]).optional(),
  worlds: z.array(batchWorldSchema).min(1).max(MAX_BATCH_WORLDS),
}).strict().superRefine((record, context) => {
  if (record.worlds.length !== record.request.worldCount || new Set(record.worlds.map(world => world.id)).size !== record.worlds.length
    || record.worlds.some((world, index) => world.index !== index + 1)) {
    context.addIssue({ code: "custom", path: ["worlds"], message: "Batch worlds must preserve the requested count, unique identities, and ordered slots." })
  }
})
