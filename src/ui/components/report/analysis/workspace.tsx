/**
 * Purpose: Compose analytical generation commands, permanent metrics, live tasks, and accepted results.
 * Pattern: Feature composition around a query lifecycle hook.
 * Usage: Mounted by ReportPage for an explicit run or batch subject.
 * Related: src/ui/hooks/use-analytical-report.ts, src/ui/components/report/analysis/board.tsx
 */
import type { RunEvent } from "@/shared/run"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import type { AnalysisSubject } from "@/shared/analytical-report"
import type { UiTexts } from "@/ui/types/i18n"
import { useAnalyticalReport } from "@/ui/hooks/use-analytical-report"
import { Button } from "@/ui/components/ui/button"
import { Alert, AlertDescription } from "@/ui/components/ui/alert"
import { ReportMetricOverview } from "../metric-overview"
import { EmptyPanel } from "../presentation"
import { AnalysisBoard } from "./board"
import { AnalysisActivity } from "./activity"
import { ResourceUsagePanel } from "./resource-usage"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { fadePresence, slidePresence } from "@/ui/animation/presence"

export function AnalysisWorkspace({ subject, events, language, t }: { subject: AnalysisSubject; events: RunEvent[]; language: "en" | "ko"; t: UiTexts }) {
  const reducedMotion = useReducedMotionPreference()
  const analysis = useAnalyticalReport(subject)
  const { record, running, command, query } = analysis
  const outdated = query.data?.freshness === "outdated"
  const unavailable = query.data?.freshness === "unavailable"
  return <div className="flex min-w-0 flex-col gap-5">
    <section className="flex flex-col gap-2"><p className="text-xs text-muted-foreground">{t.analysisScope}</p>
      <ReportMetricOverview events={events} additionalMetrics={analysis.metrics.data} scopeId={record?.id} t={t} /></section>
    {analysis.accounting.data ? <ResourceUsagePanel accounting={analysis.accounting.data} language={language} t={t} /> : null}
    {analysis.accounting.isError ? <Alert variant="destructive"><AlertDescription>{t.analysisUsageUnavailable}</AlertDescription></Alert> : null}
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">{t.analysisBoard}</h2>
      <div className="flex gap-2"><Button disabled={running || command.isPending || query.isLoading || query.isError || unavailable || record?.status === "ready" && !outdated} onClick={() => command.mutate("generate")}>
        {running ? t.builderStatusRunning : outdated ? t.analysisNew : record && record.status !== "ready" ? t.analysisRetry : t.analysisGenerate}
      </Button>{running ? <Button variant="outline" disabled={command.isPending} onClick={() => command.mutate("cancel")}>{t.analysisCancel}</Button> : null}</div>
    </div>
    {query.isError || command.isError ? <Alert variant="destructive"><AlertDescription>{t.analysisUnavailable}<Button variant="link" onClick={() => void query.refetch()}>{t.reportRetryLoad}</Button></AlertDescription></Alert> : null}
    {outdated || unavailable ? <Alert><AlertDescription>{outdated ? t.analysisOutdated : t.analysisSourceUnavailable}</AlertDescription></Alert> : null}
    {record?.status === "partial" || record?.status === "failed" || record?.status === "canceled" ? <Alert><AlertDescription>{t.analysisPartial}</AlertDescription></Alert> : null}
    {query.isLoading ? <p role="status">{t.reportLoading}</p> : null}
    <AnimatePresence>{running && record ? <m.div key={record.id} {...slidePresence(reducedMotion, "y", 6, -6)}>
      <AnalysisActivity id={record.id} t={t} />
    </m.div> : null}</AnimatePresence>
    {running && record?.report ? <p className="text-xs text-muted-foreground">{t.analysisAccepted}</p> : null}
    <AnimatePresence mode="wait">{record?.report ? <m.div key={`report:${record.id}`}
      {...slidePresence(reducedMotion, "y", 8, 0, "page")}>
      <AnalysisBoard record={record} t={t} />
    </m.div> : !running && !query.isLoading ? <m.div key="empty" {...fadePresence(reducedMotion, "quick")}><EmptyPanel title={t.analysisEmpty} body={t.analysisEmptyBody} /></m.div> : null}</AnimatePresence>
  </div>
}
