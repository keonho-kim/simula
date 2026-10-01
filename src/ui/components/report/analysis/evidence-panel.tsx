/**
 * Purpose: Fetch one selected source excerpt and restore focus when it closes.
 * Pattern: On-demand reference view.
 * Usage: Mounted in the report scope column only after selecting evidence.
 * Related: src/ui/components/report/analysis/report-tabs.tsx, src/ui/api-client/analytical-report.ts
 */
import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchAnalysisReference } from "@/ui/api-client/analytical-report"
import { referenceLocation } from "@/ui/models/report/reference-location"
import { analysisLabel } from "@/ui/models/report/analytical-view"
import { Button } from "@/ui/components/ui/button"
import type { UiTexts } from "@/ui/types/i18n"

export function ReportEvidencePanel({ reportId, referenceId, onClose, t }: {
  reportId: string; referenceId: string; onClose: () => void; t: UiTexts
}) {
  const close = useRef<HTMLButtonElement>(null)
  const query = useQuery({ queryKey: ["analysis-reference", reportId, referenceId], retry: false,
    queryFn: ({ signal }) => fetchAnalysisReference(reportId, referenceId, signal) })
  useEffect(() => { close.current?.focus({ preventScroll: true }) }, [referenceId])
  return <section className="report-reference" aria-label={t.reportEvidence}>
    <Button ref={close} variant="outline" size="sm" onClick={onClose}>{t.workspaceEvidenceClose}</Button>
    {query.isFetching ? <p role="status">{t.reportLoading}</p> : null}
    {query.isError ? <p role="alert">{t.reportLoadError}</p> : null}
    {query.data ? <><p className="text-xs font-medium">{analysisLabel(query.data.category, t)} · {referenceLocation(query.data, t)}</p>
      <p className="whitespace-pre-wrap break-words leading-7">{query.data.text}</p></> : null}
  </section>
}
