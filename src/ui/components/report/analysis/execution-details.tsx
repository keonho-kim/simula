/**
 * Purpose: Load and display report metrics only while execution details are open.
 * Pattern: Deferred query composition.
 * Usage: Mounted by report reading or preparation disclosures.
 * Related: src/ui/hooks/use-analytical-report.ts, src/ui/components/report/metric-overview.tsx
 */
import { useQuery } from "@tanstack/react-query"
import type { RunEvent } from "@/shared/run"
import type { AnalysisRecord } from "@/shared/analytical-report"
import { fetchAnalysisAccounting, fetchAnalysisMetrics } from "@/ui/api-client/analytical-report"
import { ReportMetricOverview } from "../metric-overview"
import { ResourceUsagePanel } from "./resource-usage"
import type { UiTexts } from "@/ui/types/i18n"

const METRIC_POLL_MS = 1000
export function ReportExecutionDetails({ record, events, language, t }: {
  record?: AnalysisRecord; events: RunEvent[]; language: "en" | "ko"; t: UiTexts
}) {
  const metrics = useQuery({ queryKey: ["analysis-metrics", record?.id, record?.status], enabled: !!record,
    queryFn: ({ signal }) => fetchAnalysisMetrics(record?.id ?? "", signal), retry: false,
    refetchInterval: record?.status === "running" ? METRIC_POLL_MS : false,
  })
  const accounting = useQuery({ queryKey: ["analysis-accounting", record?.id, record?.status],
    enabled: !!record?.report && record.status !== "running",
    queryFn: ({ signal }) => fetchAnalysisAccounting(record?.id ?? "", signal), retry: false,
  })
  return <section className="flex min-w-0 flex-col gap-6" aria-label={t.workspaceExecution}>
    <p className="text-sm text-muted-foreground">{record?.subject.kind === "batch" ? t.analysisBatchMetricScope : t.analysisScope}</p>
    <ReportMetricOverview events={events} additionalMetrics={metrics.data} scopeId={record?.id} t={t} />
    {metrics.isError ? <p role="alert">{t.analysisUsageUnavailable}</p> : null}
    {accounting.data ? <ResourceUsagePanel accounting={accounting.data} language={language} t={t} />
      : record?.report ? <p role={accounting.isError ? "alert" : "status"}>{accounting.isError ? t.analysisUsageUnavailable : t.reportLoading}</p> : null}
  </section>
}
