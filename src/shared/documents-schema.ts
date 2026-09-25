/**
 * Purpose: Define upload limits and portable document artifact schemas across runtimes.
 * Pattern: Shared boundary schemas.
 * Usage: Used by document persistence, extraction, and browser response parsing.
 * Related: src/shared/documents.ts, src/backend/core/documents/validation.ts
 */
import { z } from "zod"
import { DOCUMENT_FORMATS, EVIDENCE_METHODS } from "./documents"

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
export const MAX_DOCUMENTS_PER_SET = 20
export const MAX_EVIDENCE_BLOCKS = 10_000
export const EVIDENCE_BLOCK_MAX_CHARS = 1_800

const count = z.number().int().nonnegative()
const issue = z.object({ code: z.string().min(1).max(80), message: z.string().min(1).max(600) }).strict()
const coverage = z.object({
  unit: z.enum(["blocks", "regions"]), totalUnits: count, processedUnits: count, skippedUnits: count, failedUnits: count,
}).strict().refine(value => value.totalUnits === value.processedUnits + value.skippedUnits + value.failedUnits, "Invalid extraction coverage.")

const locator = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), startLine: z.number().int().positive(), endLine: z.number().int().positive(), startOffset: count, endOffset: count }).strict(),
  z.object({ kind: z.literal("page"), page: z.number().int().positive(), element: z.string().min(1).max(240) }).strict(),
  z.object({ kind: z.literal("element"), element: z.string().min(1).max(240) }).strict(),
  z.object({ kind: z.literal("table"), element: z.string().min(1).max(240), startRow: count, endRow: count, sheet: z.string().max(240).optional() }).strict(),
  z.object({ kind: z.literal("cell"), sheet: z.string().min(1).max(240), address: z.string().regex(/^[A-Z]{1,3}[1-9][0-9]{0,6}$/) }).strict(),
]).refine(value => value.kind !== "text" || (value.endLine >= value.startLine && value.endOffset > value.startOffset), "Invalid source range.")

export const evidenceBlockSchema = z.object({
  id: z.string().min(1).max(240), documentId: z.string().min(1).max(100),
  kind: z.enum(["text", "table", "visual"]), method: z.enum(EVIDENCE_METHODS),
  content: z.string().min(1).max(EVIDENCE_BLOCK_MAX_CHARS), locator,
}).strict()

export const extractionSchema = z.object({
  blocks: z.array(evidenceBlockSchema).max(MAX_EVIDENCE_BLOCKS),
  coverage,
  issues: z.array(issue).max(1_000),
}).strict()

const metadata = {
  id: z.uuid(), name: z.string().min(1).max(240), format: z.enum(DOCUMENT_FORMATS),
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES), sha256: z.string().regex(/^[a-f0-9]{64}$/), createdAt: z.iso.datetime(),
}
export const documentSchema = z.discriminatedUnion("status", [
  z.object({ ...metadata, status: z.enum(["uploaded", "processing", "canceled"]) }).strict(),
  z.object({ ...metadata, status: z.enum(["ready", "partial"]), blockCount: count, coverage, issue: issue.optional() }).strict(),
  z.object({ ...metadata, status: z.literal("failed"), issue }).strict(),
])
export const setSchema = z.object({
  id: z.uuid(), revision: count, createdAt: z.iso.datetime(), documents: z.array(documentSchema).max(MAX_DOCUMENTS_PER_SET),
}).strict()
