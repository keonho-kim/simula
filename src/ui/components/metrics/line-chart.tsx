import type { UiTexts } from "@/ui/types/i18n"
import { latestMetricPoint, type MetricHistory } from "@/ui/models/metrics/sample-history"
import { buildLineGeometry, chartWidth, chartHeight, baselineY, firstX, lastX } from "@/ui/models/metrics/line-path"

export function LineChart({ id, points, t }: { id: string; points: MetricHistory; t: UiTexts }) {
  const safeId = id.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const { path, latestY } = buildLineGeometry(points)
  const areaPath = path ? `${path} L ${lastX(points.length)} ${baselineY} L ${firstX(points.length)} ${baselineY} Z` : ""
  const latest = latestMetricPoint(points)

  return (
    <div className="relative h-14 overflow-hidden rounded-sm border border-border/70 bg-background">
      <svg className="h-full w-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
        <defs>
          <pattern id={`metric-grid-${safeId}`} width="10" height="7" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 7" fill="none" stroke="var(--border)" strokeOpacity="0.45" strokeWidth="0.28" />
          </pattern>
          <linearGradient id={`metric-fill-${safeId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <rect width={chartWidth} height={chartHeight} fill={`url(#metric-grid-${safeId})`} />
        {areaPath ? <path d={areaPath} fill={`url(#metric-fill-${safeId})`} /> : null}
        {path ? (
          <path
            d={path}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth="1.35"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {latest ? <circle cx={lastX(points.length)} cy={latestY} r="1.65" fill="var(--chart-1)" /> : null}
      </svg>
      {!points.length ? (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">{t.metricNoSamples}</div>
      ) : null}
    </div>
  )
}
