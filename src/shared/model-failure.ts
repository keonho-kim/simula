/**
 * Purpose: Describe admitted model requests that ended without usable usage metrics.
 * Pattern: Serializable failure contract.
 * Usage: Passed from the LLM adapter to runtime-owned model-call artifacts.
 * Related: src/backend/integrations/llm/execution-context.ts, src/shared/analytical-report.ts
 */
import { z } from "zod"

export const MODEL_ACCOUNTING_VERSION = 1
export const modelCallFailureSchema = z.object({ role: z.string().min(1).max(80), step: z.string().min(1).max(80),
  attempt: z.number().int().positive(), taskId: z.string().min(1).max(160).optional(),
  outcome: z.enum(["failed", "canceled"]), queueWaitMs: z.number().finite().nonnegative(),
}).strict()
export const modelCallFailureRecordSchema = z.object({ timestamp: z.iso.datetime(), failure: modelCallFailureSchema }).strict()

export type ModelCallFailure = z.infer<typeof modelCallFailureSchema>
