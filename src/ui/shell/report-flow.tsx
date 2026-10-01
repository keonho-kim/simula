/**
 * Purpose: Resolve one authoritative report scope and prepare it before displaying accepted results.
 * Pattern: Workflow composition root.
 * Usage: Mounted by App for report and report-preparation URLs; batch worlds always resolve to their parent batch.
 * Related: src/ui/models/report/preparation.ts, src/ui/pages/report-page.tsx
 */
import { WorkspaceFrame } from "@/ui/components/layout/workspace-frame"
import { RunNavigation } from "@/ui/components/navigation/run-navigation"
import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import type { RunEvent } from "@/shared/run"
import type { UiTexts } from "@/ui/types/i18n"
import { fetchRun } from "@/ui/api-client/client"
import { fetchMultiverse } from "@/ui/api-client/multiverse"
import { useRunStore } from "@/ui/stores/run-store"
import { useAnalyticalReport } from "@/ui/hooks/use-analytical-report"
import { analysisSubjectForRun, batchReadyForAnalysis, hasReportResult, shouldPrepareReport } from "@/ui/models/report/preparation"
import { ReportPage } from "@/ui/pages/report-page"
import { ReportPreparationPage } from "@/ui/pages/report-preparation-page"
import { Button } from "@/ui/components/ui/button"

const EMPTY_EVENTS: RunEvent[] = []
const BATCH_POLL_MS = 1000
export function ReportFlow({ mode, onNavigate, selectedRunId, selectedRunStatus, language, t, onHome, onBackToWorlds, onExport }: {
  mode: "report" | "report-preparation"
  onNavigate: (mode: "report" | "report-preparation") => void
  selectedRunId?: string
  selectedRunStatus?: string
  language: "en" | "ko"
  t: UiTexts
  onHome: () => void
  onBackToWorlds?: () => void
  onExport: (kind: "json" | "jsonl" | "md") => void
}) {
  const liveEvents = useRunStore(state => state.liveEvents)
  const stored = useRunStore(state => state.runState)
  const query = useQuery({ queryKey: ["runs", selectedRunId], queryFn: () => fetchRun(selectedRunId ?? ""), enabled: !!selectedRunId, retry: 2 })
  const subject = analysisSubjectForRun(query.data?.run) ?? { kind: "run" as const, id: "" }
  const isBatch = subject.kind === "batch"
  const batchQuery = useQuery({ queryKey: ["multiverse", subject.id], enabled: isBatch,
    queryFn: ({ signal }) => fetchMultiverse(subject.id, signal), retry: false,
    refetchInterval: current => current.state.data && !batchReadyForAnalysis(current.state.data) ? BATCH_POLL_MS : false })
  const state = query.data?.state ?? (stored?.runId === selectedRunId ? stored : undefined)
  const events = isBatch ? EMPTY_EVENTS : query.data?.events ?? (state ? liveEvents : EMPTY_EVENTS)
  const title = isBatch ? t.analysisMultiverseReport : query.data?.run.scenarioName || state?.scenario.sourceName || t.report
  const subjectKey = `${subject.kind}:${subject.id}`
  const analysis = useAnalyticalReport(subject)
  const attemptedSubject = useRef<string | undefined>(undefined)
  const resultReady = hasReportResult(analysis.query.data)
  const batchActive = isBatch && batchQuery.data && !batchReadyForAnalysis(batchQuery.data)
  const canGenerate = !!subject.id && (!isBatch || !!batchQuery.data && !batchQuery.isFetching && !batchQuery.isError && batchReadyForAnalysis(batchQuery.data))
  const destination = resultReady ? "report" : "report-preparation"
  const { mutate: prepare } = analysis.command
  useEffect(() => {
    if (subject.id && !batchActive && !analysis.query.isPending && mode !== destination) onNavigate(destination)
  }, [subject.id, batchActive, mode, destination, onNavigate, analysis.query.isPending])
  useEffect(() => {
    if (!canGenerate || mode !== "report-preparation" || analysis.commandPending || analysis.query.isFetching || analysis.query.isError ||
      !shouldPrepareReport(analysis.query.data) || attemptedSubject.current === subjectKey) return
    attemptedSubject.current = subjectKey
    prepare("generate")
  }, [canGenerate, mode, subjectKey, analysis.commandPending, analysis.query.isFetching, analysis.query.isError, analysis.query.data, prepare])
  if (!subject.id || batchActive || isBatch && !batchQuery.data && !resultReady) {
    const failed = query.isError || isBatch && batchQuery.isError
    return <WorkspaceFrame>
      <RunNavigation runId={selectedRunId} onHome={onHome} onBackToWorlds={onBackToWorlds} t={t} />
      <h1 className="text-lg font-semibold">{title}</h1>
      <p role={failed ? "alert" : "status"}>{failed ? t.reportLoadError : batchActive ? t.analysisBatchWaiting : t.reportLoading}</p>
      {failed ? <Button variant="outline" onClick={() => { if (query.isError) void query.refetch(); else void batchQuery.refetch() }}>{t.reportRetryLoad}</Button> : null}
    </WorkspaceFrame>
  }
  if (mode !== destination || analysis.query.isPending) return <WorkspaceFrame>
    <RunNavigation runId={selectedRunId} onHome={onHome} onBackToWorlds={onBackToWorlds} t={t} /><p role="status">{t.reportLoading}</p>
  </WorkspaceFrame>
  if (mode === "report-preparation") return <ReportPreparationPage selectedRunId={selectedRunId} onBackToWorlds={onBackToWorlds}
    key={subjectKey} title={title} analysis={analysis} events={events} t={t} onHome={onHome} runError={isBatch ? undefined : query.data?.run.error} />
  return <ReportPage onBackToWorlds={onBackToWorlds} selectedRunId={selectedRunId} title={title}
    status={isBatch ? batchQuery.data?.status : query.data?.run.status ?? selectedRunStatus}
    state={isBatch ? undefined : state} events={events} subject={subject} analysis={analysis}
    loadError={query.isError} runError={isBatch ? undefined : query.data?.run.error} onRetryLoad={() => void query.refetch()}
    language={language} t={t} onHome={onHome} onExport={onExport} />
}
