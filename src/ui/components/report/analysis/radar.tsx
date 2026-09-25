/**
 * Purpose: Display validated SWOT influence without inventing missing axis values.
 * Pattern: Deterministic SVG presentation.
 * Usage: Shown with the analytical board after report acceptance.
 * Related: src/ui/models/report/analytical-view.ts, src/ui/styles/report.css
 */
import type { AnalysisSection } from "@/shared/analytical-report"
import * as m from "motion/react-m"
import type { UiTexts } from "@/ui/types/i18n"
import { useReducedMotionPreference } from "@/ui/animation/use-reduced-motion-preference"
import { slidePresence } from "@/ui/animation/presence"
import { analysisLabel, radarPoints, SWOT_SECTIONS } from "@/ui/models/report/analytical-view"

export function SwotRadar({ sections, t }: { sections: AnalysisSection[]; t: UiTexts }) {
  const reducedMotion = useReducedMotionPreference()
  const points = radarPoints(sections)
  return <figure className="report-radar" aria-label={t.analysisSwot}>
    {points ? <m.div {...slidePresence(reducedMotion, "y", 4, 0, "reveal")}><svg viewBox="0 0 240 240" role="img" aria-label={t.analysisRubric}>
      {[20, 40, 60, 80].map(radius => <polygon key={radius} points={`120,${120-radius} ${120+radius},120 120,${120+radius} ${120-radius},120`} fill="none" stroke="var(--border)" />)}
      <path d="M120 40V200 M40 120H200" fill="none" stroke="var(--border)" />
      <polygon points={points} fill="var(--chart-1)" fillOpacity="0.14" stroke="var(--chart-1)" strokeWidth="2" />
      {SWOT_SECTIONS.map((id, index) => <text key={id} x={[120, 211, 120, 29][index]} y={[23, 124, 223, 124][index]} textAnchor="middle" fill="currentColor" fontSize="11">{analysisLabel(id, t)}</text>)}
    </svg></m.div> : <p className="p-6 text-sm text-muted-foreground">{t.analysisUnknown}</p>}
    <figcaption className="flex flex-col gap-3"><dl className="flex flex-wrap gap-3 [&>*]:min-w-0 [&>*]:flex-[1_1_120px]">{SWOT_SECTIONS.map(id => {
      const value = sections.find(section => section.id === id && section.status === "ready")?.score?.value
      return <div key={id}><dt className="text-xs text-muted-foreground">{analysisLabel(id, t)}</dt><dd className="text-sm font-medium">{value ?? t.analysisUnknown}</dd></div>
    })}</dl><p className="text-xs leading-5 text-muted-foreground">{t.analysisRubric}</p></figcaption>
  </figure>
}
