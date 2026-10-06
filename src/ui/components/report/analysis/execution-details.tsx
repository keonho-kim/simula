/**
 * Purpose: Display scoped report metrics in preparation or accepted-report execution details.
 * Pattern: Scoped query composition.
 * Usage: Always mounted above preparation; deferred until the execution tab opens in an accepted report.
 * Related: src/ui/hooks/use-analytical-report.ts, src/ui/components/report/metric-overview.tsx
 */
import { useQuery } from "@tanstack/react-query"
import { useIsPresent } from "motion/react"
import type { RunEvent } from "@/shared/run"
import type { AnalysisRecord } from "@/shared/analytical-report"
import { fetchAnalysisAccounting, fetchAnalysisMetrics } from "@/ui/api-client/analytical-report"
import { ReportMetricOverview } from "../metric-overview"
import { ResourceUsagePanel } from "./resource-usage"
import type { UiTexts } from "@/ui/types/i18n"
import { cn } from "@/ui/lib/class-names"

const METRIC_POLL_MS = 1000
export function ReportExecutionDetails({ record, events, language, t, context = "report" }: {
  record?: AnalysisRecord; events: RunEvent[]; language: "en" | "ko"; t: UiTexts; context?: "report" | "preparation"
}) {
  const present = useIsPresent()
  const metrics = useQuery({ queryKey: ["analysis-metrics", record?.id, record?.status], enabled: present && !!record,
    queryFn: ({ signal }) => fetchAnalysisMetrics(record?.id ?? "", signal), retry: false,
    refetchInterval: present && record?.status === "running" ? METRIC_POLL_MS : false,
  })
  const accounting = useQuery({ queryKey: ["analysis-accounting", record?.id, record?.status],
    enabled: present && !!record?.report && record.status !== "running",
    queryFn: ({ signal }) => fetchAnalysisAccounting(record?.id ?? "", signal), retry: false,
  })
  const scope = <p className="text-sm text-muted-foreground">{record?.subject.kind === "batch" ? t.analysisBatchMetricScope : t.analysisScope}</p>
  return <section className={cn("flex min-w-0 flex-col", context === "preparation" ? "gap-2" : "gap-6")} aria-label={t.workspaceExecution}>
    {context === "report" ? scope : null}
    <ReportMetricOverview context={context} events={events} additionalMetrics={metrics.data} scopeId={record?.id} t={t} />
    {context === "preparation" ? scope : null}
    {metrics.isError ? <p role="alert">{t.analysisUsageUnavailable}</p> : null}
    {accounting.data ? <ResourceUsagePanel accounting={accounting.data} language={language} t={t} />
      : record?.report ? <p role={accounting.isError ? "alert" : "status"}>{accounting.isError ? t.analysisUsageUnavailable : t.reportLoading}</p> : null}
  </section>
}
