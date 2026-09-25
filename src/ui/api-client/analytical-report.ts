/**
 * Purpose: Read and control persisted analytical reports through validated HTTP contracts.
 * Pattern: Browser transport adapter.
 * Usage: Used by report lifecycle and reference views.
 * Related: src/shared/analytical-report-schema.ts, src/ui/hooks/use-analytical-report.ts
 */
import { z } from "zod"
import type { AnalysisSubject } from "@/shared/analytical-report"
import { analysisLookupSchema, analysisRecordSchema, analysisReferenceSchema, analysisMetricCallSchema, analyticalExportSchema, resourceAccountingSchema } from "@/shared/analytical-report-schema"
import { requestJson, unavailableServerArtifact } from "./request-json"
import { readBrowserArtifact } from "@/ui/browser-storage/database/artifacts/read"
import { saveBrowserArtifact } from "@/ui/browser-storage/database/artifacts/save"

export async function lookupAnalysis(subject: AnalysisSubject, signal?: AbortSignal) {
  const key = `${subject.kind}:${subject.id}`
  try {
    const lookup = analysisLookupSchema.parse(await requestJson(`/api/analysis?kind=${subject.kind}&subject=${encodeURIComponent(subject.id)}`, { signal }))
    if (!lookup.analysis) {
      const retained = await readBrowserArtifact<z.infer<typeof analysisLookupSchema>>("analysis-lookup", key)
      if (retained?.analysis) {
        const analysis = retained.analysis.status === "running" ? analysisRecordSchema.parse({ ...retained.analysis, status: "failed" }) : retained.analysis
        const preserved = analysisLookupSchema.parse({ analysis, freshness: "unavailable" })
        await saveBrowserArtifact("analysis-lookup", key, subject.id, analysis.status, preserved)
        return preserved
      }
    }
    await saveBrowserArtifact("analysis-lookup", key, subject.id, lookup.analysis?.status ?? "empty", lookup)
    if (lookup.analysis) await saveBrowserArtifact("analysis", lookup.analysis.id, subject.id, lookup.analysis.status, lookup.analysis)
    if (lookup.analysis?.report) await fetchAnalyticalExport(lookup.analysis.id, signal).catch(() => undefined)
    return lookup
  } catch (error) {
    if (!unavailableServerArtifact(error)) throw error
    const saved = await readBrowserArtifact<z.infer<typeof analysisLookupSchema>>("analysis-lookup", key)
    if (!saved) throw error
    return saved
  }
}
export async function createAnalysis(subject: AnalysisSubject, id: string) {
  const analysis = z.object({ analysis: analysisRecordSchema }).parse(await requestJson("/api/analysis", {
    method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": id }, body: JSON.stringify({ subject }),
  })).analysis
  return saveBrowserArtifact("analysis", analysis.id, subject.id, analysis.status, analysis)
}
export async function controlAnalysis(id: string, action: "retry" | "cancel") {
  await requestJson(`/api/analysis/${encodeURIComponent(id)}/${action}`, { method: "POST" })
}
export async function fetchAnalysisReference(id: string, reference: string, signal?: AbortSignal) {
  const key = `${id}:${reference}`
  try {
    const result = z.object({ reference: analysisReferenceSchema }).parse(await requestJson(`/api/analysis/${encodeURIComponent(id)}/reference?id=${encodeURIComponent(reference)}`, { signal })).reference
    return saveBrowserArtifact("analysis-reference", key, id, "ready", result)
  } catch (error) {
    if (!unavailableServerArtifact(error)) throw error
    const saved = await readBrowserArtifact<z.infer<typeof analysisReferenceSchema>>("analysis-reference", key)
    if (saved) return saved
    const exported = await readBrowserArtifact<z.infer<typeof analyticalExportSchema>>("analysis-export", id)
    const referenceValue = exported?.references.find(item => item.id === reference)
    if (referenceValue) return referenceValue
    throw error
  }
}
export async function fetchAnalysisMetrics(id: string, signal?: AbortSignal) {
  try {
    const calls = z.object({ calls: z.array(analysisMetricCallSchema) }).parse(await requestJson(`/api/analysis/${encodeURIComponent(id)}/metrics`, { signal })).calls
    return saveBrowserArtifact("analysis-metrics", id, id, "ready", calls)
  } catch (error) {
    if (!unavailableServerArtifact(error)) throw error
    const saved = await readBrowserArtifact<z.infer<typeof analysisMetricCallSchema>[]>("analysis-metrics", id)
    if (saved) return saved
    const exported = await readBrowserArtifact<z.infer<typeof analyticalExportSchema>>("analysis-export", id)
    if (exported) return exported.metrics
    throw error
  }
}

export async function fetchAnalysisAccounting(id: string, signal?: AbortSignal) {
  try {
    const accounting = z.object({ accounting: resourceAccountingSchema }).parse(await requestJson(`/api/analysis/${encodeURIComponent(id)}/accounting`, { signal })).accounting
    return saveBrowserArtifact("analysis-accounting", id, id, "ready", accounting)
  } catch (error) {
    if (!unavailableServerArtifact(error)) throw error
    const saved = await readBrowserArtifact<z.infer<typeof resourceAccountingSchema>>("analysis-accounting", id)
    if (saved) return saved
    const exported = await readBrowserArtifact<z.infer<typeof analyticalExportSchema>>("analysis-export", id)
    if (exported) return exported.accounting
    throw error
  }
}

export async function fetchAnalyticalExport(id: string, signal?: AbortSignal) {
  try {
    const value = analyticalExportSchema.parse(await requestJson(`/api/analysis/${encodeURIComponent(id)}/export?kind=json`, { signal }))
    return saveBrowserArtifact("analysis-export", id, id, "ready", value)
  } catch (error) {
    if (!unavailableServerArtifact(error)) throw error
    const saved = await readBrowserArtifact<z.infer<typeof analyticalExportSchema>>("analysis-export", id)
    if (!saved) throw error
    return saved
  }
}
