/**
 * Purpose: Render accepted report results and retained simulation inspection without generation controls.
 * Pattern: Page composition with deferred detail renderers.
 * Usage: Rendered by the application for a selected terminal run.
 * Related: src/ui/pages/report-preparation-page.tsx, src/ui/components/report/analysis/results.tsx
 */
import { lazy, Suspense, useEffect, useRef } from "react"
import { RunNavigation } from "@/ui/components/navigation/run-navigation"
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
import type { ReportReadingTab } from "@/ui/components/report/analysis/report-tabs"
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
  loadError: boolean
  runError?: string
  onRetryLoad: () => void
  language: "en" | "ko"
  t: UiTexts
  onHome: () => void
  onBackToWorlds?: () => void
  onExport: (kind: "json" | "jsonl" | "md") => void
}
export function ReportPage({ selectedRunId, title, status, state, events, subject, analysis,
  loadError, runError, onRetryLoad, language, t, onHome, onBackToWorlds, onExport }: ReportPageProps) {
  const additionalTabs: ReportReadingTab[] = subject.kind === "batch" ? [] : [
    { id: "relations", title: t.reportRelations, content: <Suspense fallback={<p role="status">{t.reportLoading}</p>}><ReportRelationshipPanel state={state} t={t} /></Suspense> },
    { id: "conversations", title: t.reportConversations, content: <Suspense fallback={<p role="status">{t.reportLoading}</p>}><ReportConversationPanel key={selectedRunId} state={state} events={events} t={t} /></Suspense> },
    ...(state?.reportCommentary ? [{ id: "commentary", title: t.reportCommentary, content: <Suspense fallback={<p role="status">{t.reportLoading}</p>}><ReportCommentaryPanel commentary={state.reportCommentary} t={t} /></Suspense> }] : []),
  ]
  const resultHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" })
    resultHeading.current?.focus({ preventScroll: true })
  }, [subject.id, subject.kind])
  return <main className="min-h-svh bg-card text-foreground"><div className="mx-auto flex w-[94vw] max-w-[1600px] flex-col gap-5 py-5">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <div className="flex min-w-0 items-center gap-3"><RunNavigation runId={selectedRunId} onHome={onHome} onBackToWorlds={onBackToWorlds} t={t} />
        <div className="min-w-0"><h1 ref={resultHeading} tabIndex={-1} className="truncate text-lg font-semibold outline-none">{title}</h1><p className="text-xs text-muted-foreground">{t.report}</p></div>
        {status ? <Badge variant={status === "failed" ? "destructive" : "secondary"}>{reportStatusLabel(status, t)}</Badge> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <ReportExportMenu runId={selectedRunId} subject={subject} onRunExport={onExport} t={t} />
      </div>
    </header>
    {loadError ? <div role="alert" className="text-sm text-destructive">{t.reportLoadError}<Button variant="link" onClick={onRetryLoad}>{t.reportRetryLoad}</Button></div> : null}
    {runError ? <p role="alert" className="text-sm text-destructive">{runError}</p> : null}
    {selectedRunId ? <AnalysisResults additionalTabs={additionalTabs} analysis={analysis} events={events} language={language} t={t} /> : <ReportMetricOverview events={events} t={t} />}

  </div></main>
}
