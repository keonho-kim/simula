/**
 * Purpose: Show report generation and recovery before the accepted result screen.
 * Pattern: Preparation page composition.
 * Usage: Rendered by ReportFlow while analysis is absent, running, or awaiting recovery.
 * Related: src/ui/hooks/use-analytical-report.ts, src/ui/components/report/analysis/activity.tsx, src/ui/components/report/analysis/execution-details.tsx
 */
import { RunNavigation } from "@/ui/components/navigation/run-navigation"
import { WorkspaceHeader } from "@/ui/components/layout/workspace-frame"
import type { RunEvent } from "@/shared/run"
import type { UiTexts } from "@/ui/types/i18n"
import type { useAnalyticalReport } from "@/ui/hooks/use-analytical-report"
import { Button } from "@/ui/components/ui/button"
import { Alert, AlertDescription } from "@/ui/components/ui/alert"
import { AnalysisActivity } from "@/ui/components/report/analysis/activity"
import { ReportExecutionDetails } from "@/ui/components/report/analysis/execution-details"

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
  const { query, command, record, running } = analysis
  const unavailable = query.data?.freshness === "unavailable"
  const stopped = Boolean(record && !running)
  return <main className="min-h-svh bg-background text-foreground">
    <div className="workspace-frame">
      <WorkspaceHeader title={t.analysisPreparing} description={title}
        navigation={<RunNavigation runId={selectedRunId} onHome={onHome} onBackToWorlds={onBackToWorlds} t={t} />} />
      <ReportExecutionDetails context="preparation" record={record ?? undefined} events={events}
        language={record?.language ?? "en"} t={t} />
      {query.isError || command.isError ? <Alert variant="destructive"><AlertDescription>{t.analysisUnavailable}</AlertDescription></Alert> : null}
      {runError ? <Alert variant="destructive"><AlertDescription>{runError}</AlertDescription></Alert> : null}
      {unavailable ? <Alert><AlertDescription>{t.analysisSourceUnavailable}</AlertDescription></Alert> : null}
      {stopped ? <Alert><AlertDescription>{t.analysisPartial}</AlertDescription></Alert> : null}
      <AnalysisActivity key={record?.id ?? "pending"} id={record?.id} running={running} t={t} />
      {!record && !unavailable && !query.isError && !command.isError ? <p role="status" className="text-sm">{t.reportLoading}</p> : null}
      <div className="flex flex-wrap gap-2">
        {running ? <Button variant="outline" disabled={command.isPending} onClick={() => command.mutate("cancel")}>{t.analysisCancel}</Button> : null}
        {query.isError ? <Button disabled={query.isFetching} onClick={() => void query.refetch()}>{t.reportRetryLoad}</Button>
          : !unavailable && (stopped || command.isError) ? <Button disabled={command.isPending} onClick={() => command.mutate("generate")}>{t.analysisRetry}</Button> : null}
      </div>
    </div>
  </main>
}
