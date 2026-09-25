/**
 * Purpose: Read accepted analytical prose and inspect its scoped source excerpts.
 * Pattern: Detail presentation with on-demand reference retrieval.
 * Usage: Mounted only inside an open report section dialog.
 * Related: src/ui/api-client/analytical-report.ts, src/ui/components/markdown/markdown-content.tsx
 */
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { AnalysisSection } from "@/shared/analytical-report"
import type { UiTexts } from "@/ui/types/i18n"
import { fetchAnalysisReference } from "@/ui/api-client/analytical-report"
import { referenceLocation } from "@/ui/models/report/reference-location"
import { analysisLabel } from "@/ui/models/report/analytical-view"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"
import { Button } from "@/ui/components/ui/button"

export function AnalysisSectionDetail({ reportId, section, t }: { reportId: string; section: AnalysisSection; t: UiTexts }) {
  const [referenceId, setReferenceId] = useState<string>()
  const reference = useQuery({ queryKey: ["analysis-reference", reportId, referenceId], enabled: !!referenceId, retry: false,
    queryFn: ({ signal }) => fetchAnalysisReference(reportId, referenceId ?? "", signal) })
  const ids = [...new Set([...section.evidenceIds, ...section.findings.flatMap(finding => finding.evidenceIds), ...(section.score?.evidenceIds ?? [])])]
  return <div className="flex flex-col gap-6">
    <p className="text-sm font-medium leading-6">{section.summary}</p>
    {section.score ? <section className="rounded-md border p-3"><p>{section.score.value ?? t.analysisUnknown}</p><p className="text-sm text-muted-foreground">{section.score.rationale}</p></section> : null}
    <MarkdownContent content={section.content} />
    {section.findings.length ? <section><h3 className="mb-3 text-sm font-semibold">{t.reportDetailedItems}</h3><ul className="flex list-disc flex-col gap-2 pl-5">{section.findings.map((finding, index) => <li key={index}>
      {finding.provenance?.length ? <span className="mr-2 text-xs text-muted-foreground">{finding.provenance.map(category => analysisLabel(category, t)).join(" · ")}</span> : null}
      {finding.text}
    </li>)}</ul></section> : null}
    <section className="flex flex-col gap-3 border-t pt-4">
      <h3 className="text-sm font-semibold">{t.reportEvidence}</h3>
      <div className="flex flex-wrap gap-2">{ids.map((id, index) => <Button key={id} variant={id === referenceId ? "secondary" : "outline"} size="sm" onClick={() => setReferenceId(id)}>{t.reportEvidence} {index + 1}</Button>)}</div>
      {reference.isFetching ? <p role="status">{t.reportLoading}</p> : null}
      {reference.isError ? <p role="alert">{t.reportLoadError}</p> : null}
      {reference.data ? <aside className="rounded-md border bg-muted/30 p-4">
        <p className="mb-2 break-all text-xs text-muted-foreground">{analysisLabel(reference.data.category, t)} · {referenceLocation(reference.data, t)}</p>
        <p className="whitespace-pre-wrap break-words leading-6">{reference.data.text}</p>
      </aside> : null}
    </section>
  </div>
}
