/**
 * Purpose: Show report generation and recovery before the accepted result screen.
 * Pattern: Preparation page composition.
 * Usage: Rendered by ReportFlow while analysis is absent, running, or awaiting recovery.
 * Related: src/ui/hooks/use-analytical-report.ts, src/ui/components/report/analysis/activity.tsx
 */
import { HomeIcon } from "lucide-react"
import type { RunEvent } from "@/shared/run"
import type { UiTexts } from "@/ui/types/i18n"
import type { useAnalyticalReport } from "@/ui/hooks/use-analytical-report"
import { Button } from "@/ui/components/ui/button"
import { Alert, AlertDescription } from "@/ui/components/ui/alert"
import { ReportMetricOverview } from "@/ui/components/report/metric-overview"
import { AnalysisActivity } from "@/ui/components/report/analysis/activity"

export function ReportPreparationPage({ title, analysis, events, t, onHome, batch, onToggleScope, runError }: {
  runError?: string
  title: string
  analysis: ReturnType<typeof useAnalyticalReport>
  events: RunEvent[]
  t: UiTexts
  onHome: () => void
  batch: boolean
  onToggleScope?: () => void
}) {
  const { query, command, record, running } = analysis
  const unavailable = query.data?.freshness === "unavailable"
  const stopped = Boolean(record && !running)
  return <main className="min-h-svh bg-background text-foreground">
    <div className="mx-auto flex w-[94vw] max-w-[1600px] flex-col gap-5 py-5">
      <header className="flex items-center gap-3 border-b pb-4">
        <Button aria-label={t.home} variant="ghost" size="icon" onClick={onHome}><HomeIcon /></Button>
        <div><h1 className="text-lg font-semibold">{t.analysisPreparing}</h1><p className="text-xs text-muted-foreground">{title}</p></div>
        {onToggleScope ? <Button className="ml-auto" variant="outline" onClick={onToggleScope}>{batch ? t.analysisSingle : t.analysisBatch}</Button> : null}
      </header>
      <ReportMetricOverview events={events} additionalMetrics={analysis.metrics.data} scopeId={record?.id} t={t} />
      <p className="text-sm text-muted-foreground">{t.analysisPreparationDescription}</p>
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
