/**
 * Purpose: Keep live model measurements compact until their charts are requested.
 * Pattern: Memoized presentation with deferred chart mounting.
 * Usage: Mounted by SimulationPage above the operational panels.
 * Related: src/ui/components/metrics/llm-metrics-panel.tsx
 */
import { memo, useMemo, useState } from "react"
import { useRunStore } from "@/ui/stores/run-store"
import { buildMetricSeries } from "@/ui/models/metrics/metric-series"
import { LlmMetricsPanelView } from "./llm-metrics-panel"
import type { UiTexts } from "@/ui/types/i18n"

export const LiveMetricSummary = memo(function LiveMetricSummary({ t }: { t: UiTexts }) {
  const data = useRunStore(state => state.metricData)
  const series = useMemo(() => buildMetricSeries(data, t), [data, t])
  const [open, setOpen] = useState(false)
  return <section className="live-metric-summary" aria-label={t.workspaceMetrics}>
    <dl>{series.map(series => <div key={series.title}><dt>{series.title}</dt><dd>{series.latestValue}</dd></div>)}</dl>
    <details onToggle={event => setOpen(event.currentTarget.open)}><summary>{t.workspaceMetricDetails}</summary>
      {open ? <LlmMetricsPanelView data={data} t={t} /> : null}
    </details>
  </section>
})
