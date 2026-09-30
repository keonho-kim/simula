/**
 * Purpose: Present accepted analysis, permanent metrics, and retained-result warnings.
 * Pattern: Read-only report composition.
 * Usage: Mounted by ReportPage after preparation has finished.
 * Related: src/ui/hooks/use-analytical-report.ts, src/ui/components/report/analysis/report-tabs.tsx
 */
import type { RunEvent } from "@/shared/run"
import type { UiTexts } from "@/ui/types/i18n"
import type { useAnalyticalReport } from "@/ui/hooks/use-analytical-report"
import { Alert, AlertDescription } from "@/ui/components/ui/alert"
import { ReportMetricOverview } from "../metric-overview"
import { EmptyPanel } from "../presentation"
import { ReportReadingTabs, type ReportReadingTab } from "./report-tabs"
import { ResourceUsagePanel } from "./resource-usage"

export function AnalysisResults({ analysis, events, language, additionalTabs = [], t }: {
  analysis: Pick<ReturnType<typeof useAnalyticalReport>, "record" | "query" | "metrics" | "accounting">
  events: RunEvent[]
  language: "en" | "ko"
  additionalTabs?: ReportReadingTab[]
  t: UiTexts
}) {
  const { record, query, metrics, accounting } = analysis
  return <div className="flex min-w-0 flex-col gap-5">
    <p className="text-xs text-muted-foreground">{record?.subject.kind === "batch" ? t.analysisBatchMetricScope : t.analysisScope}</p>
    <ReportMetricOverview events={events} additionalMetrics={metrics.data} scopeId={record?.id} t={t} />
    {query.isError ? <Alert variant="destructive"><AlertDescription>{t.reportLoadError}</AlertDescription></Alert> : null}
    {query.data?.freshness === "outdated" || query.data?.freshness === "unavailable" ? <Alert><AlertDescription>
      {query.data.freshness === "outdated" ? t.analysisOutdated : t.analysisSourceUnavailable}
    </AlertDescription></Alert> : null}
    {record && record.status !== "ready" ? <Alert><AlertDescription>{t.analysisPartial}</AlertDescription></Alert> : null}
    {record?.report ? <ReportReadingTabs record={record} t={t} additionalTabs={[...additionalTabs, {
      id: "usage", title: t.analysisUsageTab, content: accounting.data ? <ResourceUsagePanel accounting={accounting.data} language={language} t={t} />
        : <p role={accounting.isError ? "alert" : "status"}>{accounting.isError ? t.analysisUsageUnavailable : t.reportLoading}</p>,
    }]} /> : <EmptyPanel title={t.analysisEmpty} body={t.analysisEmptyBody} />}
  </div>
}
