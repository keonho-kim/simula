/**
 * Purpose: Parse persisted story-builder model calls for scenarios, worlds, and document pages.
 * Pattern: Serializable boundary schema.
 * Usage: Used by scenario, world, and document stores for metrics artifacts.
 * Related: src/backend/storage/scenario-builder/build-store.ts, src/backend/storage/documents/document-store.ts
 */
import { z } from "zod"

const nonnegative = z.number().finite().nonnegative()

export const storyBuilderMetricCallSchema = z.object({ timestamp: z.iso.datetime(), metrics: z.object({
  role: z.literal("storyBuilder"), step: z.literal("draft"), attempt: z.number().int().positive(),
  ttftMs: nonnegative, durationMs: nonnegative, queueWaitMs: nonnegative.optional(),
  inputTokens: nonnegative, reasoningTokens: nonnegative, outputTokens: nonnegative, totalTokens: nonnegative,
  tokenSource: z.enum(["provider", "unavailable"]),
}).strict() }).strict()

export type StoryBuilderMetricCall = z.infer<typeof storyBuilderMetricCallSchema>
export const documentMetricCallSchema = storyBuilderMetricCallSchema.extend({ page: z.number().int().positive() }).strict()
