/**
 * Purpose: Compose accepted analyses into a compact board with scoped read-only details.
 * Pattern: Report presentation composition.
 * Usage: Rendered by the analytical workspace when a report artifact exists.
 * Related: src/ui/components/report/analysis/section-detail.tsx, src/shared/analytical-report.ts
 */
import type { AnalysisRecord, StoredAnalysisSectionId } from "@/shared/analytical-report"
import type { UiTexts } from "@/ui/types/i18n"
import { analysisLabel } from "@/ui/models/report/analytical-view"
import { ReportDetailDialog } from "./detail-dialog"
import { AnalysisSectionDetail } from "./section-detail"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"

const GROUPS: Array<{ title: "analysisDevelopments" | "analysisResponses" | "analysisNextSteps"; sections: StoredAnalysisSectionId[] }> = [
  { title: "analysisDevelopments", sections: ["outcomes", "turning-points", "trajectories"] },
  { title: "analysisResponses", sections: ["actors", "conditions"] },
  { title: "analysisNextSteps", sections: ["implications", "conclusion"] },
]
export function AnalysisBoard({ record, t }: { record: AnalysisRecord; t: UiTexts }) {
  const report = record.report
  if (!report) return null
  const conclusion = report.sections.find(section => section.id === "conclusion")
  const coverage = report.coverage
  const legacy = !report.sections.some(section => section.id === "outcomes")
  const groups = legacy ? [{ title: "analysisSavedSections" as const, sections: report.sections.map(section => section.id) }]
    : GROUPS.map(group => ({ ...group, sections: group.sections.filter(id => id !== "trajectories" || record.subject.kind === "batch") }))
  return <section className="flex min-w-0 flex-col gap-5" aria-label={t.analysisBoard}>
    <div className="report-conclusion-grid">
      <div className="flex flex-col gap-3"><h2 className="text-base font-semibold">{t.analysisConclusion}</h2>
        <MarkdownContent generated content={conclusion?.summary} fallback={t.analysisFailed} />
        <p className="text-xs text-muted-foreground">{t.analysisSimulationScope}</p>
        <p className="text-xs text-muted-foreground">{t.analysisPerspective}: <MarkdownContent generated inline content={report.perspective.focus} /> · <MarkdownContent generated inline content={report.perspective.objective} /></p>
        <p className="text-xs text-muted-foreground">{t.analysisCoverage.replace("{completed}", String(coverage.completed)).replace("{requested}", String(coverage.requested)).replace("{analyzed}", String(coverage.analyzed))}</p>
        <p className="text-xs text-muted-foreground">{t.analysisMissing.replace("{failed}", String(coverage.failed)).replace("{canceled}", String(coverage.canceled)).replace("{interrupted}", String(coverage.interrupted))}</p>
      </div>
    </div>
    <div className="report-analysis-columns">{groups.map(group => <section key={group.title} className="flex min-w-0 flex-col gap-3">
      <h3 className="border-b pb-2 text-sm font-semibold">{t[group.title]}</h3>
      {group.sections.map(id => {
        const section = report.sections.find(section => section.id === id)
        return section?.status === "ready" ? <ReportDetailDialog key={id} title={analysisLabel(id, t)} summary={section.summary} t={t}>
          <AnalysisSectionDetail reportId={record.id} section={section} t={t} />
          {id === "trajectories" ? <div className="mt-6 flex flex-col gap-3">{report.trajectories.categories.map(category => <p key={category.id} className="text-sm"><MarkdownContent generated inline content={category.label} /> — {t.analysisFrequency.replace("{count}", String(category.worldIds.length)).replace("{total}", String(coverage.analyzed))}</p>)}
            <p className="text-xs text-muted-foreground">{t.analysisUnclassified.replace("{count}", String(report.trajectories.unclassifiedWorldIds.length))}</p></div> : null}
        </ReportDetailDialog> : <div key={id} className="rounded-md border border-dashed p-4"><h4 className="text-sm font-medium">{analysisLabel(id, t)}</h4><p className="text-xs text-muted-foreground">{t.analysisFailed}</p></div>
      })}
    </section>)}</div>
  </section>
}
