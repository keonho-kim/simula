/**
 * Purpose: Present each accepted analysis as a full inline report with accessible section tabs.
 * Pattern: Tab composition with deferred panel mounting.
 * Usage: Rendered by AnalysisResults; optional record panels remain lazy until selected.
 * Related: src/ui/components/report/analysis/section-detail.tsx, src/ui/styles/report.css
 */
import type { ReactNode } from "react"
import type { AnalysisRecord } from "@/shared/analytical-report"
import type { UiTexts } from "@/ui/types/i18n"
import { analysisLabel } from "@/ui/models/report/analytical-view"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/components/ui/tabs"
import { AnalysisSectionDetail } from "./section-detail"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"

export interface ReportReadingTab { id: string; title: string; content: ReactNode }
export function ReportReadingTabs({ record, additionalTabs = [], t }: {
  record: AnalysisRecord; additionalTabs?: ReportReadingTab[]; t: UiTexts
}) {
  const report = record.report
  if (!report) return null
  const sections = [...report.sections].sort((a, b) => a.id === "conclusion" ? -1 : b.id === "conclusion" ? 1 : 0)
  const coverage = report.coverage
  return <section className="flex min-w-0 flex-col gap-4" aria-label={t.analysisBoard}>
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
      <p>{t.analysisCoverage.replace("{completed}", String(coverage.completed)).replace("{requested}", String(coverage.requested)).replace("{analyzed}", String(coverage.analyzed))}</p>
      <p>{t.analysisMissing.replace("{failed}", String(coverage.failed)).replace("{canceled}", String(coverage.canceled)).replace("{interrupted}", String(coverage.interrupted))}</p>
    </div>
    <Tabs key={record.id} defaultValue="conclusion" className="report-reading-tabs min-w-0">
      <TabsList aria-label={t.analysisReportTabs} variant="line">
        {sections.map(section => <TabsTrigger key={section.id} value={section.id}>{analysisLabel(section.id, t)}</TabsTrigger>)}
        {additionalTabs.map(tab => <TabsTrigger key={tab.id} value={tab.id}>{tab.title}</TabsTrigger>)}
      </TabsList>
      {sections.map(section => <TabsContent key={section.id} value={section.id}>
        <article className="report-reading-document" aria-label={analysisLabel(section.id, t)}>
          <header className="flex flex-col gap-3 border-b pb-5">
            <h2 className="text-xl font-semibold">{analysisLabel(section.id, t)}</h2>
            <p className="text-sm text-muted-foreground">{t.analysisPerspective}: <MarkdownContent generated inline content={report.perspective.focus} /> · <MarkdownContent generated inline content={report.perspective.objective} /></p>
          </header>
          {section.status === "ready" ? <AnalysisSectionDetail reportId={record.id} section={section} t={t} /> : <p role="status">{t.analysisFailed}</p>}
          {section.id === "trajectories" ? <section className="flex flex-col gap-3" aria-label={t.analysisTrajectories}>
            {report.trajectories.categories.map(category => <p key={category.id}><MarkdownContent generated inline content={category.label} /> — {t.analysisFrequency.replace("{count}", String(category.worldIds.length)).replace("{total}", String(coverage.analyzed))}</p>)}
            <p className="text-sm text-muted-foreground">{t.analysisUnclassified.replace("{count}", String(report.trajectories.unclassifiedWorldIds.length))}</p>
          </section> : null}
          <p className="border-t pt-4 text-xs text-muted-foreground">{t.analysisSimulationScope}</p>
        </article>
      </TabsContent>)}
      {additionalTabs.map(tab => <TabsContent key={tab.id} value={tab.id}><section className="report-reading-supplement" aria-label={tab.title}>
        <h2 className="text-xl font-semibold">{tab.title}</h2>{tab.content}
      </section></TabsContent>)}
    </Tabs>
  </section>
}
