/**
 * Purpose: Parse per-world launch controls and persistent preparation records.
 * Pattern: Shared boundary schemas.
 * Usage: Consumed by world API/storage and the browser launch flow.
 * Related: src/shared/world-preparation.ts, src/shared/world-story-schema.ts
 */
import { z } from "zod"
import { worldStorySchema } from "./world-story-schema"
import { runPathSegmentSchema } from "./run-schema"

export const worldControlsSchema = z.object({
  actionsPerType: z.number().int().positive().default(3), maxRound: z.number().int().positive().default(8),
  fastMode: z.boolean().default(false), autonomousProgress: z.boolean().default(false),
  outputLength: z.enum(["short", "medium", "long"]).default("short"),
}).strict()
export const worldPreparationRequestSchema = z.object({ scenarioId: z.uuid(), controls: worldControlsSchema }).strict()
export const worldPreparationRecordSchema = z.object({
  id: z.uuid(), request: worldPreparationRequestSchema, sourceScenarioVersion: z.number().int().positive(), createdAt: z.iso.datetime(),
  usageAccountingVersion: z.literal(1).optional(),
  batchId: z.uuid().optional(),
  status: z.enum(["preparing", "ready", "failed", "canceled"]), issue: z.string().max(1000).optional(),
  story: worldStorySchema.optional(), runId: runPathSegmentSchema.optional(),
}).strict().superRefine((record, context) => {
  if (record.status === "ready" && !record.story) context.addIssue({ code: "custom", path: ["story"], message: "A ready world requires its validated story." })
  if (record.story && (record.story.id !== record.id || record.story.sourceScenarioId !== record.request.scenarioId || record.story.sourceScenarioVersion !== record.sourceScenarioVersion)) {
    context.addIssue({ code: "custom", path: ["story"], message: "World story identity must match its owning world and source revision." })
  }
  if (record.runId && record.runId !== `world-${record.id}`) context.addIssue({ code: "custom", path: ["runId"], message: "World run identity must match its preparation owner." })
})
