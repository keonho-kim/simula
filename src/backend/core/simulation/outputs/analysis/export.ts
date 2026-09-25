/**
 * Purpose: Assemble a portable analytical snapshot from accepted artifacts and references.
 * Pattern: Pure deterministic projection.
 * Usage: Called by the report runtime after scoped artifacts have been read.
 * Related: src/shared/analytical-report-schema.ts, src/backend/runtime/analysis/jobs.ts
 */
import { createHash } from "node:crypto"
import type { AnalysisRecord, AnalysisReference, AnalyticalExport, ResourceAccounting } from "@/shared/analytical-report"
import type { ModelMetrics } from "@/shared/run"
import { analyticalExportSchema } from "@/shared/analytical-report-schema"

export function assembleAnalyticalExport(record: AnalysisRecord, references: AnalysisReference[],
  metrics: Array<{ timestamp: string; metrics: ModelMetrics }>, accounting: ResourceAccounting,
  freshness: AnalyticalExport["freshness"]): AnalyticalExport {
  if (!record.report) throw new Error("The analysis has no accepted report to export.")
  const ids = [...new Set(record.report.evidenceIds)]
  if (references.length !== ids.length || references.some((reference, index) => reference.id !== ids[index])) {
    throw new Error("The analytical export is missing a required source reference.")
  }
  const acceptedDigest = createHash("sha256").update(JSON.stringify(record.report)).digest("hex")
  return analyticalExportSchema.parse({ formatVersion: 2, reportId: record.id, subject: record.subject,
    inputRevision: record.inputRevision, acceptedDigest, createdAt: record.createdAt,
    language: record.language, executionStatus: record.status, freshness,
    metricsScope: "analysis_generation", report: record.report, references, metrics, accounting })
}
