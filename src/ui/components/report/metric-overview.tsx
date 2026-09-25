/**
 * Purpose: Render run-level LLM metrics above the analytical report and its detail views.
 * Pattern: Presentation Component.
 * Usage: Rendered by ReportPage with persisted or live run events.
 * Related: src/ui/models/report/metric-overview.ts, src/ui/components/metrics/llm-metrics-panel.tsx
 */
import { useEffect, useMemo, useState } from "react"
import type { RunEvent } from "@/shared"
import type { AnalyticalExport } from "@/shared/analytical-report"
import type { UiTexts } from "@/ui/types/i18n"
import { MetricPanel } from "@/ui/components/metrics/llm-metrics-panel"
import { appendReportMetricSummary, emptyReportMetricSummary, reportMetricSeries, type ReportMetricSummary } from "@/ui/models/report/metric-overview"

const EMPTY_CALLS: AnalyticalExport["metrics"] = []
interface Projection { events: RunEvent[]; scopeId?: string; processed: number; tail?: string; summary: ReportMetricSummary }

export function ReportMetricOverview({ events, t, additionalMetrics = EMPTY_CALLS, scopeId }: {
  events: RunEvent[]; t: UiTexts; additionalMetrics?: AnalyticalExport["metrics"]; scopeId?: string
}) {
  const base = useMemo(() => appendReportMetricSummary(emptyReportMetricSummary(), events), [events])
  const [projection, setProjection] = useState<Projection>(() => ({ events, scopeId, processed: 0, summary: base }))
  useEffect(() => {
    setProjection(previous => {
      const unchangedPrefix = previous.events === events && previous.scopeId === scopeId &&
        previous.processed <= additionalMetrics.length &&
        (previous.processed === 0 || previous.tail === JSON.stringify(additionalMetrics[previous.processed - 1]))
      const from = unchangedPrefix ? previous.processed : 0
      if (unchangedPrefix && from === additionalMetrics.length) return previous
      const added: RunEvent[] = additionalMetrics.slice(from).map(call => ({
        type: "model.metrics", runId: scopeId ?? "", timestamp: call.timestamp, metrics: call.metrics,
      }))
      return { events, scopeId, processed: additionalMetrics.length,
        tail: additionalMetrics.length ? JSON.stringify(additionalMetrics.at(-1)) : undefined,
        summary: appendReportMetricSummary(unchangedPrefix ? previous.summary : base, added) }
    })
  }, [additionalMetrics, base, events, scopeId])
  const summary = projection.events === events && projection.scopeId === scopeId ? projection.summary : base
  const series = useMemo(() => reportMetricSeries(summary, t), [summary, t])

  return (
    <section
      aria-label={t.llmMetrics}
      className="flex min-w-0 flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-[1_1_240px]"
    >
      {series.map((item) => (
        <MetricPanel key={item.title} context="report" series={item} t={t} />
      ))}
    </section>
  )
}
