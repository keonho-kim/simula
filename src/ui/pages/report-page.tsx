/**
 * Purpose: Render accepted report results and retained simulation inspection without generation controls.
 * Pattern: Page composition with deferred detail renderers.
 * Usage: Rendered by the application for a selected terminal run.
 * Related: src/ui/pages/report-preparation-page.tsx, src/ui/components/report/analysis/results.tsx
 */
import { lazy, Suspense, useEffect, useRef } from "react"
import { HomeIcon } from "lucide-react"
import { Badge } from "@/ui/components/ui/badge"
import { Button } from "@/ui/components/ui/button"
import type { UiTexts } from "@/ui/types/i18n"
import type { RunEvent, SimulationState } from "@/shared"
import type { AnalysisSubject } from "@/shared/analytical-report"
import { reportStatusLabel } from "@/ui/models/report/status-label"
import { ReportMetricOverview } from "@/ui/components/report/metric-overview"
import { ReportExportMenu } from "@/ui/components/report/analysis/export-menu"
import { AnalysisResults } from "@/ui/components/report/analysis/results"
import type { useAnalyticalReport } from "@/ui/hooks/use-analytical-report"
import { ReportDetailDialog } from "@/ui/components/report/analysis/detail-dialog"
import "@/ui/styles/report.css"

const ReportRelationshipPanel = lazy(() => import("@/ui/components/report/relationship-panel").then(module => ({ default: module.ReportRelationshipPanel })))
const ReportConversationPanel = lazy(() => import("@/ui/components/report/conversation-panel").then(module => ({ default: module.ReportConversationPanel })))
const ReportCommentaryPanel = lazy(() => import("@/ui/components/report/commentary-panel").then(module => ({ default: module.ReportCommentaryPanel })))
interface ReportPageProps {
  selectedRunId?: string
  title: string
  status?: string
  state?: SimulationState
  events: RunEvent[]
  subject: AnalysisSubject
  analysis: Pick<ReturnType<typeof useAnalyticalReport>, "query" | "record" | "metrics" | "accounting">
  batch: boolean
  onToggleScope?: () => void
  loadError: boolean
  runError?: string
  onRetryLoad: () => void
  language: "en" | "ko"
  t: UiTexts
  onHome: () => void
  onExport: (kind: "json" | "jsonl" | "md") => void
}
export function ReportPage({ selectedRunId, title, status, state, events, subject, analysis, batch, onToggleScope,
  loadError, runError, onRetryLoad, language, t, onHome, onExport }: ReportPageProps) {
  const resultHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" })
    resultHeading.current?.focus({ preventScroll: true })
  }, [subject.id, subject.kind])
  return <main className="min-h-svh bg-card text-foreground"><div className="mx-auto flex w-[94vw] max-w-[1600px] flex-col gap-5 py-5">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <div className="flex min-w-0 items-center gap-3"><Button aria-label={t.home} variant="ghost" size="icon" onClick={onHome}><HomeIcon /></Button>
        <div className="min-w-0"><h1 ref={resultHeading} tabIndex={-1} className="truncate text-lg font-semibold outline-none">{title}</h1><p className="text-xs text-muted-foreground">{t.report}</p></div>
        {status ? <Badge variant={status === "failed" ? "destructive" : "secondary"}>{reportStatusLabel(status, t)}</Badge> : null}
      </div>
      <div className="flex flex-wrap gap-2">{onToggleScope ? <Button variant="outline" onClick={onToggleScope}>{batch ? t.analysisSingle : t.analysisBatch}</Button> : null}
        <ReportExportMenu runId={selectedRunId} subject={subject} onRunExport={onExport} t={t} />
      </div>
    </header>
    {loadError ? <div role="alert" className="text-sm text-destructive">{t.reportLoadError}<Button variant="link" onClick={onRetryLoad}>{t.reportRetryLoad}</Button></div> : null}
    {runError ? <p role="alert" className="text-sm text-destructive">{runError}</p> : null}
    {selectedRunId ? <AnalysisResults analysis={analysis} events={events} language={language} t={t} /> : <ReportMetricOverview events={events} t={t} />}
    <section className="flex flex-col gap-3" aria-label={t.analysisRecords}><h2 className="text-base font-semibold">{t.analysisRecords}</h2>
      <div className="report-analysis-columns">
        <ReportDetailDialog title={t.reportRelations} t={t}><Suspense fallback={<p role="status">{t.reportLoading}</p>}><ReportRelationshipPanel state={state} t={t} /></Suspense></ReportDetailDialog>
        <ReportDetailDialog title={t.reportConversations} t={t}><Suspense fallback={<p role="status">{t.reportLoading}</p>}><ReportConversationPanel key={selectedRunId} state={state} events={events} t={t} /></Suspense></ReportDetailDialog>
        {state?.reportCommentary ? <ReportDetailDialog title={t.reportCommentary} t={t}><Suspense fallback={<p role="status">{t.reportLoading}</p>}><ReportCommentaryPanel commentary={state.reportCommentary} t={t} /></Suspense></ReportDetailDialog> : null}
      </div>
    </section>
  </div></main>
}
