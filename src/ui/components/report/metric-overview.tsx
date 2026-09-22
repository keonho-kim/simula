/**
 * Purpose: Render run-level LLM metrics independently from the selected Report tab.
 * Pattern: Presentation Component.
 * Usage: Rendered by ReportPage with persisted or live run events.
 * Related: src/ui/models/report/metric-overview.ts, src/ui/components/metrics/llm-metrics-panel.tsx
 */
import { useMemo } from "react"
import type { RunEvent } from "@/shared"
import type { UiTexts } from "@/ui/types/i18n"
import { MetricPanel } from "@/ui/components/metrics/llm-metrics-panel"
import { buildReportMetricSeries } from "@/ui/models/report/metric-overview"

export function ReportMetricOverview({ events, t }: { events: RunEvent[]; t: UiTexts }) {
  const series = useMemo(() => buildReportMetricSeries(events, t), [events, t])

  return (
    <section
      aria-label={t.llmMetrics}
      className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {series.map((item) => (
        <MetricPanel key={item.title} context="report" series={item} t={t} />
      ))}
    </section>
  )
}
