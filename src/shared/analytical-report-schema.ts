/**
 * Purpose: Parse analysis output, citations, rubric values, and portable report records.
 * Pattern: Shared boundary schema.
 * Usage: Used by report generation, storage, and browser response parsing.
 * Related: src/shared/analytical-report.ts, src/shared/documents-schema.ts
 */
import { z } from "zod"
import { ANALYSIS_SECTIONS } from "./analytical-report"
import { EVIDENCE_METHODS } from "./documents"
import { runPathSegmentSchema } from "./run-schema"
import { extractionSchema } from "./documents-schema"

const prose = z.string().trim().min(1).regex(/[\p{L}\p{N}]/u, "Write meaningful prose, not punctuation placeholders.")
export const MAX_ANALYTICAL_SUMMARY_CHARS = 2400
const MAX_ANALYSIS_DETAIL_CHARS = 16_000
export const MAX_ANALYSIS_REFERENCES = 24
const refs = z.array(z.string().min(1).max(240)).max(MAX_ANALYSIS_REFERENCES)
const count = z.number().int().nonnegative()
export const analysisSubjectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("run"), id: runPathSegmentSchema }).strict(),
  z.object({ kind: z.literal("batch"), id: z.uuid() }).strict(),
])
export const analysisReferenceSchema = z.object({
  id: prose.max(240), category: z.enum(["source_claim", "scenario_assumption", "user_constraint", "simulation_observation", "analytical_interpretation"]), text: prose.max(1800),
  documentId: z.uuid().optional(), locator: extractionSchema.shape.blocks.element.shape.locator.optional(),
  method: z.enum(EVIDENCE_METHODS).optional(), sourceKind: z.enum(["text", "table", "visual"]).optional(),
  runId: runPathSegmentSchema.optional(), recordId: z.string().max(240).optional(), roundIndex: count.optional(),
}).strict()
export const analyticalSummarySchema = z.object({ summary: prose.max(MAX_ANALYTICAL_SUMMARY_CHARS), findings: z.array(prose.max(180)).max(3), evidenceIds: refs.max(8) }).strict()
export const analysisPerspectiveSchema = z.object({ focus: prose.max(MAX_ANALYTICAL_SUMMARY_CHARS), objective: prose.max(MAX_ANALYTICAL_SUMMARY_CHARS),
  horizon: prose.max(MAX_ANALYTICAL_SUMMARY_CHARS), boundary: prose.max(MAX_ANALYTICAL_SUMMARY_CHARS), evidenceIds: refs }).strict()
export const analysisFindingsSchema = z.object({
  summary: prose.max(MAX_ANALYTICAL_SUMMARY_CHARS), findings: z.array(z.object({ text: prose.max(MAX_ANALYTICAL_SUMMARY_CHARS), evidenceIds: refs.min(1) }).strict()).max(3),
  gaps: z.array(prose.max(MAX_ANALYTICAL_SUMMARY_CHARS)).max(3), evidenceIds: refs,
}).strict()
export const analysisScoreSchema = z.object({ value: z.number().int().min(0).max(4).nullable(), rationale: prose.max(MAX_ANALYTICAL_SUMMARY_CHARS), evidenceIds: refs }).strict()
  .refine(value => value.value === null || value.evidenceIds.length > 0, "An assessed score requires supporting references; use null for unknown.")
export const analysisDetailSchema = z.object({ summary: prose.max(MAX_ANALYTICAL_SUMMARY_CHARS), content: prose.max(MAX_ANALYSIS_DETAIL_CHARS), evidenceIds: refs }).strict()
const reportFindingSchema = analysisFindingsSchema.shape.findings.element.extend({ provenance: z.array(analysisReferenceSchema.shape.category).min(1).optional() })
const section = z.object({ id: z.enum(ANALYSIS_SECTIONS), status: z.enum(["ready", "failed"]), summary: z.string().max(MAX_ANALYTICAL_SUMMARY_CHARS), content: z.string().max(MAX_ANALYSIS_DETAIL_CHARS),
  findings: z.array(reportFindingSchema).max(3), evidenceIds: refs, score: analysisScoreSchema.optional() }).strict()
export const analyticalReportSchema = z.object({
  perspective: analysisPerspectiveSchema,
  coverage: z.object({ requested: count, completed: count, failed: count, canceled: count, interrupted: count, analyzed: count }).strict(),
  trajectories: z.object({ categories: z.array(z.object({ id: prose.max(80), label: prose.max(100), description: prose.max(300), worldIds: z.array(z.string()).max(50) })).max(6), unclassifiedWorldIds: z.array(z.string()).max(50) }).strict(),
  sections: z.array(section).length(ANALYSIS_SECTIONS.length), evidenceIds: z.array(z.string().max(240)).max(400),
  unavailableInputs: z.array(z.string().max(240)).max(1000),
}).strict().refine(value => new Set(value.sections.map(section => section.id)).size === ANALYSIS_SECTIONS.length, "Report sections must be unique.")
export const analysisRecordSchema = z.object({
  id: z.uuid(), subject: analysisSubjectSchema, inputRevision: prose.max(128), language: z.enum(["en", "ko"]), fastMode: z.boolean(),
  usageAccountingVersion: z.literal(1).optional(),
  createdAt: z.iso.datetime(), status: z.enum(["running", "ready", "partial", "failed", "canceled"]), report: analyticalReportSchema.optional(),
  maxCalls: z.number().int().positive(), deadlineAt: z.iso.datetime(), stopReason: z.enum(["user", "deadline", "call_budget"]).optional(),
}).strict().refine(record => !["ready", "partial"].includes(record.status) || !!record.report, "A finished report requires its validated result.")

export const analysisLookupSchema = z.union([
  z.object({ analysis: z.null(), freshness: z.null() }).strict(),
  z.object({ analysis: analysisRecordSchema, freshness: z.enum(["current", "outdated", "unavailable"]) }).strict(),
])

const nonnegative = z.number().finite().nonnegative()
export const analysisMetricCallSchema = z.object({ timestamp: z.iso.datetime(), metrics: z.object({ role: z.literal("observer"), step: z.literal("reportCommentary"),
  attempt: z.number().int().positive(), ttftMs: nonnegative, durationMs: nonnegative, queueWaitMs: nonnegative.optional(),
  inputTokens: nonnegative, reasoningTokens: nonnegative, outputTokens: nonnegative, totalTokens: nonnegative,
  tokenSource: z.enum(["provider", "unavailable"]),
}).strict() }).strict()

const usageValue = z.number().finite().nonnegative().nullable()
export const resourceUsageSchema = z.object({ calls: count.nullable(), observedCalls: count,
  durationMs: usageValue, queueWaitMs: usageValue, inputTokens: usageValue, reasoningTokens: usageValue,
  outputTokens: usageValue, totalTokens: usageValue, unavailableTokenCalls: count,
}).strict().refine(value => value.calls === null || value.observedCalls <= value.calls, "Observed calls exceed recorded calls.")
export const resourceAccountingSchema = z.object({
  sharedPreparation: resourceUsageSchema.nullable(),
  worlds: z.array(z.object({ worldId: runPathSegmentSchema, runId: runPathSegmentSchema.optional(),
    source: z.enum(["run", "preparation", "unavailable"]), usage: resourceUsageSchema }).strict()).max(50),
  worldsUnavailable: z.boolean(), worldTotal: resourceUsageSchema, analysisGeneration: resourceUsageSchema, overall: resourceUsageSchema,
}).strict()

export const analyticalExportSchema = z.object({
  formatVersion: z.literal(2), reportId: z.uuid(), subject: analysisSubjectSchema,
  inputRevision: prose.max(128), acceptedDigest: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.iso.datetime(), language: z.enum(["en", "ko"]),
  executionStatus: analysisRecordSchema.shape.status,
  freshness: z.enum(["current", "outdated", "unavailable"]),
  metricsScope: z.literal("analysis_generation"), report: analyticalReportSchema,
  references: z.array(analysisReferenceSchema).max(400), metrics: z.array(analysisMetricCallSchema).max(40_000),
  accounting: resourceAccountingSchema,
}).strict()
