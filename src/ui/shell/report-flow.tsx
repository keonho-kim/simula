/**
 * Purpose: Route report discovery through a dedicated generation page before showing accepted results.
 * Pattern: Workflow composition root.
 * Usage: Mounted by App for report and report-preparation URLs.
 * Related: src/ui/pages/report-page.tsx, src/ui/pages/report-preparation-page.tsx
 */
import { RunNavigation } from "@/ui/components/navigation/run-navigation"
import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { RunEvent } from "@/shared/run"
import type { UiTexts } from "@/ui/types/i18n"
import { fetchRun } from "@/ui/api-client/client"
import { useRunStore } from "@/ui/stores/run-store"
import { useAnalyticalReport } from "@/ui/hooks/use-analytical-report"
import { hasReportResult, shouldPrepareReport } from "@/ui/models/report/preparation"
import { ReportPage } from "@/ui/pages/report-page"
import { ReportPreparationPage } from "@/ui/pages/report-preparation-page"

const EMPTY_EVENTS: RunEvent[] = []
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
  const [batch, setBatch] = useState(false)
  const liveEvents = useRunStore(state => state.liveEvents)
  const stored = useRunStore(state => state.runState)
  const query = useQuery({ queryKey: ["runs", selectedRunId], queryFn: () => fetchRun(selectedRunId ?? ""), enabled: !!selectedRunId, retry: 2 })
  const state = query.data?.state ?? (stored?.runId === selectedRunId ? stored : undefined)
  const events = query.data?.events ?? (state ? liveEvents : EMPTY_EVENTS)
  const title = query.data?.run.scenarioName || state?.scenario.sourceName || t.report
  const batchId = query.data?.run.batchId
  const subject = batch && batchId ? { kind: "batch" as const, id: batchId } : { kind: "run" as const, id: selectedRunId ?? "" }
  const subjectKey = `${subject.kind}:${subject.id}`
  const analysis = useAnalyticalReport(subject)
  const attemptedSubject = useRef<string | undefined>(undefined)
  const resultReady = hasReportResult(analysis.query.data)
  const destination = resultReady ? "report" : "report-preparation"
  const { mutate: prepare } = analysis.command
  useEffect(() => {
    if (selectedRunId && !analysis.query.isPending && mode !== destination) onNavigate(destination)
  }, [selectedRunId, mode, destination, onNavigate, analysis.query.isPending])
  useEffect(() => {
    if (mode !== "report-preparation" || !subject.id || analysis.commandPending || analysis.query.isFetching || analysis.query.isError ||
      !shouldPrepareReport(analysis.query.data) || attemptedSubject.current === subjectKey) return
    attemptedSubject.current = subjectKey
    prepare("generate")
  }, [mode, subject.id, subjectKey, analysis.commandPending, analysis.query.isFetching, analysis.query.isError, analysis.query.data, prepare])
  const onToggleScope = batchId ? () => setBatch(current => !current) : undefined
  if (selectedRunId && (mode !== destination || analysis.query.isPending)) {
    return <main className="min-h-svh bg-background p-6"><RunNavigation runId={selectedRunId} onHome={onHome} onBackToWorlds={onBackToWorlds} t={t} /><p role="status">{t.reportLoading}</p></main>
  }
  if (mode === "report-preparation") {
    return <ReportPreparationPage selectedRunId={selectedRunId} onBackToWorlds={onBackToWorlds} key={subjectKey} title={title} analysis={analysis} events={events} t={t}
      batch={batch} onToggleScope={onToggleScope} onHome={onHome} runError={query.data?.run.error} />
  }
  return <ReportPage onBackToWorlds={onBackToWorlds} selectedRunId={selectedRunId} title={title} status={query.data?.run.status ?? selectedRunStatus}
    state={state} events={events} subject={subject} analysis={analysis} batch={batch} onToggleScope={onToggleScope}
    loadError={query.isError} runError={query.data?.run.error} onRetryLoad={() => void query.refetch()}
    language={language} t={t} onHome={onHome} onExport={onExport} />
}
