/**
 * Purpose: Show report generation and recovery before the accepted result screen.
 * Pattern: Preparation page composition.
 * Usage: Rendered by ReportFlow while analysis is absent, running, or awaiting recovery.
 * Related: src/ui/hooks/use-analytical-report.ts, src/ui/components/report/analysis/activity.tsx
 */
import { lazy, Suspense, useState } from "react"
import { RunNavigation } from "@/ui/components/navigation/run-navigation"
import type { RunEvent } from "@/shared/run"
import type { UiTexts } from "@/ui/types/i18n"
import type { useAnalyticalReport } from "@/ui/hooks/use-analytical-report"
import { Button } from "@/ui/components/ui/button"
import { Alert, AlertDescription } from "@/ui/components/ui/alert"
import { AnalysisActivity } from "@/ui/components/report/analysis/activity"

const ExecutionDetails = lazy(() => import("@/ui/components/report/analysis/execution-details").then(module => ({ default: module.ReportExecutionDetails })))

export function ReportPreparationPage({ selectedRunId, onBackToWorlds, title, analysis, events, t, onHome, runError }: {
  selectedRunId?: string
  onBackToWorlds?: () => void
  runError?: string
  title: string
  analysis: ReturnType<typeof useAnalyticalReport>
  events: RunEvent[]
  t: UiTexts
  onHome: () => void
}) {
  const [usageOpen, setUsageOpen] = useState(false)
  const { query, command, record, running } = analysis
  const unavailable = query.data?.freshness === "unavailable"
  const stopped = Boolean(record && !running)
  return <main className="min-h-svh bg-background text-foreground">
    <div className="workspace-frame">
      <header className="flex items-center gap-3 border-b pb-4">
        <RunNavigation runId={selectedRunId} onHome={onHome} onBackToWorlds={onBackToWorlds} t={t} />
        <div><h1 className="text-3xl font-semibold">{t.analysisPreparing}</h1><p className="text-xs text-muted-foreground">{title}</p></div>
      </header>

      <p className="text-sm text-muted-foreground">{t.analysisPreparationDescription}</p>
      {query.isError || command.isError ? <Alert variant="destructive"><AlertDescription>{t.analysisUnavailable}</AlertDescription></Alert> : null}
      {runError ? <Alert variant="destructive"><AlertDescription>{runError}</AlertDescription></Alert> : null}
      {unavailable ? <Alert><AlertDescription>{t.analysisSourceUnavailable}</AlertDescription></Alert> : null}
      {stopped ? <Alert><AlertDescription>{t.analysisPartial}</AlertDescription></Alert> : null}
      <AnalysisActivity key={record?.id ?? "pending"} id={record?.id} running={running} t={t} />
      {!record && !unavailable && !query.isError && !command.isError ? <p role="status" className="text-sm">{t.reportLoading}</p> : null}
      <details className="workspace-disclosure" onToggle={event => setUsageOpen(event.currentTarget.open)}><summary>{t.workspaceExecution}</summary>
        {usageOpen ? <Suspense fallback={<p>{t.reportLoading}</p>}><ExecutionDetails record={record ?? undefined} events={events} language={record?.language ?? "en"} t={t} /></Suspense> : null}
      </details>
      <div className="flex flex-wrap gap-2">
        {running ? <Button variant="outline" disabled={command.isPending} onClick={() => command.mutate("cancel")}>{t.analysisCancel}</Button> : null}
        {query.isError ? <Button disabled={query.isFetching} onClick={() => void query.refetch()}>{t.reportRetryLoad}</Button>
          : !unavailable && (stopped || command.isError) ? <Button disabled={command.isPending} onClick={() => command.mutate("generate")}>{t.analysisRetry}</Button> : null}
      </div>
    </div>
  </main>
}
