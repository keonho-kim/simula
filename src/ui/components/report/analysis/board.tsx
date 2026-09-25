/**
 * Purpose: Compose accepted analyses into a compact board with scoped read-only details.
 * Pattern: Report presentation composition.
 * Usage: Rendered by the analytical workspace when a report artifact exists.
 * Related: src/ui/components/report/analysis/section-detail.tsx, src/ui/components/report/analysis/radar.tsx
 */
import type { AnalysisRecord, AnalysisSectionId } from "@/shared/analytical-report"
import type { UiTexts } from "@/ui/types/i18n"
import { analysisLabel } from "@/ui/models/report/analytical-view"
import { ReportDetailDialog } from "./detail-dialog"
import { AnalysisSectionDetail } from "./section-detail"
import { SwotRadar } from "./radar"

const GROUPS: Array<{ title: "analysisSwot" | "analysisTrajectories" | "analysisAssessments"; sections: AnalysisSectionId[] }> = [
  { title: "analysisSwot", sections: ["strengths", "weaknesses", "opportunities", "threats"] },
  { title: "analysisTrajectories", sections: ["trajectories", "actors"] },
  { title: "analysisAssessments", sections: ["materials", "scenario", "conclusion"] },
]
export function AnalysisBoard({ record, t }: { record: AnalysisRecord; t: UiTexts }) {
  const report = record.report
  if (!report) return null
  const conclusion = report.sections.find(section => section.id === "conclusion")
  const coverage = report.coverage
  return <section className="flex min-w-0 flex-col gap-5" aria-label={t.analysisBoard}>
    <div className="report-conclusion-grid">
      <div className="flex flex-col gap-3"><h2 className="text-base font-semibold">{t.analysisConclusion}</h2>
        <p className="text-sm leading-7">{conclusion?.summary || t.analysisFailed}</p>
        <p className="text-xs text-muted-foreground">{t.analysisSimulationScope}</p>
        <p className="text-xs text-muted-foreground">{t.analysisPerspective}: {report.perspective.focus} · {report.perspective.objective}</p>
        <p className="text-xs text-muted-foreground">{t.analysisCoverage.replace("{completed}", String(coverage.completed)).replace("{requested}", String(coverage.requested)).replace("{analyzed}", String(coverage.analyzed))}</p>
        <p className="text-xs text-muted-foreground">{t.analysisMissing.replace("{failed}", String(coverage.failed)).replace("{canceled}", String(coverage.canceled)).replace("{interrupted}", String(coverage.interrupted))}</p>
      </div><SwotRadar sections={report.sections} t={t} />
    </div>
    <div className="report-analysis-columns">{GROUPS.map(group => <section key={group.title} className="flex min-w-0 flex-col gap-3">
      <h3 className="border-b pb-2 text-sm font-semibold">{t[group.title]}</h3>
      {group.sections.map(id => {
        const section = report.sections.find(section => section.id === id)
        return section?.status === "ready" ? <ReportDetailDialog key={id} title={analysisLabel(id, t)} summary={section.summary} t={t}>
          <AnalysisSectionDetail reportId={record.id} section={section} t={t} />
          {id === "trajectories" ? <div className="mt-6 flex flex-col gap-3">{report.trajectories.categories.map(category => <p key={category.id} className="text-sm">{category.label} — {t.analysisFrequency.replace("{count}", String(category.worldIds.length)).replace("{total}", String(coverage.analyzed))}</p>)}
            <p className="text-xs text-muted-foreground">{t.analysisUnclassified.replace("{count}", String(report.trajectories.unclassifiedWorldIds.length))}</p></div> : null}
        </ReportDetailDialog> : <div key={id} className="rounded-md border border-dashed p-4"><h4 className="text-sm font-medium">{analysisLabel(id, t)}</h4><p className="text-xs text-muted-foreground">{t.analysisFailed}</p></div>
      })}
    </section>)}</div>
  </section>
}
