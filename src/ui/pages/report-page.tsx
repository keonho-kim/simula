/**
 * Purpose: Compose a single-page analytical report with retained simulation inspection.
 * Pattern: Page composition with deferred detail renderers.
 * Usage: Rendered by the application for a selected terminal run.
 * Related: src/ui/components/report/analysis/workspace.tsx, src/ui/styles/report.css
 */
import { lazy, Suspense, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { HomeIcon } from "lucide-react"
import { Badge } from "@/ui/components/ui/badge"
import { Button } from "@/ui/components/ui/button"
import { fetchRun } from "@/ui/api-client/client"
import type { UiTexts } from "@/ui/types/i18n"
import type { RunEvent } from "@/shared/run"
import { useRunStore } from "@/ui/stores/run-store"
import { reportStatusLabel } from "@/ui/models/report/status-label"
import { ReportMetricOverview } from "@/ui/components/report/metric-overview"
import { ReportExportMenu } from "@/ui/components/report/analysis/export-menu"
import { AnalysisWorkspace } from "@/ui/components/report/analysis/workspace"
import { ReportDetailDialog } from "@/ui/components/report/analysis/detail-dialog"
import "@/ui/styles/report.css"

const ReportRelationshipPanel = lazy(() => import("@/ui/components/report/relationship-panel").then(module => ({ default: module.ReportRelationshipPanel })))
const ReportConversationPanel = lazy(() => import("@/ui/components/report/conversation-panel").then(module => ({ default: module.ReportConversationPanel })))
const ReportCommentaryPanel = lazy(() => import("@/ui/components/report/commentary-panel").then(module => ({ default: module.ReportCommentaryPanel })))
const EMPTY_EVENTS: RunEvent[] = []
interface ReportPageProps {
  selectedRunId?: string
  selectedRunStatus?: string
  language: "en" | "ko"
  t: UiTexts
  onHome: () => void
  onExport: (kind: "json" | "jsonl" | "md") => void
}
export function ReportPage({ selectedRunId, selectedRunStatus, language, t, onHome, onExport }: ReportPageProps) {
  const [batch, setBatch] = useState(false)
  const liveEvents = useRunStore(state => state.liveEvents)
  const stored = useRunStore(state => state.runState)
  const query = useQuery({ queryKey: ["runs", selectedRunId], queryFn: () => fetchRun(selectedRunId ?? ""), enabled: !!selectedRunId, retry: 2 })
  const state = query.data?.state ?? (stored?.runId === selectedRunId ? stored : undefined)
  const events = query.data?.events ?? (state ? liveEvents : EMPTY_EVENTS)
  const title = query.data?.run.scenarioName || state?.scenario.sourceName || t.report
  const status = query.data?.run.status ?? selectedRunStatus
  const batchId = query.data?.run.batchId
  const subject = batch && batchId ? { kind: "batch" as const, id: batchId } : { kind: "run" as const, id: selectedRunId ?? "" }
  return <main className="min-h-svh bg-card text-foreground"><div className="mx-auto flex w-[94vw] max-w-[1600px] flex-col gap-5 py-5">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <div className="flex min-w-0 items-center gap-3"><Button aria-label={t.home} variant="ghost" size="icon" onClick={onHome}><HomeIcon /></Button>
        <div className="min-w-0"><h1 className="truncate text-lg font-semibold">{title}</h1><p className="text-xs text-muted-foreground">{t.report}</p></div>
        {status ? <Badge variant={status === "failed" ? "destructive" : "secondary"}>{reportStatusLabel(status, t)}</Badge> : null}
      </div>
      <div className="flex flex-wrap gap-2">{batchId ? <Button variant="outline" onClick={() => setBatch(!batch)}>{batch ? t.analysisSingle : t.analysisBatch}</Button> : null}
        <ReportExportMenu runId={selectedRunId} subject={subject} onRunExport={onExport} t={t} />
      </div>
    </header>
    {query.isError ? <div role="alert" className="text-sm text-destructive">{t.reportLoadError}<Button variant="link" onClick={() => void query.refetch()}>{t.reportRetryLoad}</Button></div> : null}
    {query.data?.run.error ? <p role="alert" className="text-sm text-destructive">{query.data.run.error}</p> : null}
    {selectedRunId ? <AnalysisWorkspace key={`${subject.kind}:${subject.id}`} subject={subject} events={events} language={language} t={t} /> : <ReportMetricOverview events={events} t={t} />}
    <section className="flex flex-col gap-3" aria-label={t.analysisRecords}><h2 className="text-base font-semibold">{t.analysisRecords}</h2>
      <div className="report-analysis-columns">
        <ReportDetailDialog title={t.reportRelations} t={t}><Suspense fallback={<p role="status">{t.reportLoading}</p>}><ReportRelationshipPanel state={state} t={t} /></Suspense></ReportDetailDialog>
        <ReportDetailDialog title={t.reportConversations} t={t}><Suspense fallback={<p role="status">{t.reportLoading}</p>}><ReportConversationPanel key={selectedRunId} state={state} events={events} t={t} /></Suspense></ReportDetailDialog>
        {state?.reportCommentary ? <ReportDetailDialog title={t.reportCommentary} t={t}><Suspense fallback={<p role="status">{t.reportLoading}</p>}><ReportCommentaryPanel commentary={state.reportCommentary} t={t} /></Suspense></ReportDetailDialog> : null}
      </div>
    </section>
  </div></main>
}
