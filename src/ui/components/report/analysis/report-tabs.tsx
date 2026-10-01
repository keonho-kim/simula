/**
 * Purpose: Read one full report chapter with a contents rail and adjacent evidence scope.
 * Pattern: Editorial composition with deferred chapter mounting.
 * Usage: Mounted in the report's analysis view.
 * Related: src/ui/components/report/analysis/section-detail.tsx, src/ui/styles/report.css
 */
import { useEffect, useRef, useState, type ReactNode } from "react"
import type { AnalysisRecord } from "@/shared/analytical-report"
import type { UiTexts } from "@/ui/types/i18n"
import { analysisLabel } from "@/ui/models/report/analytical-view"
import { AnalysisSectionDetail } from "./section-detail"
import { ReportEvidencePanel } from "./evidence-panel"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"

export interface ReportReadingTab { id: string; title: string; content: ReactNode }
export function ReportReadingTabs({ record, t }: { record: AnalysisRecord; t: UiTexts }) {
  const [selected, setSelected] = useState("conclusion")
  const [evidence, setEvidence] = useState<{ id: string; trigger: HTMLButtonElement }>()
  const heading = useRef<HTMLHeadingElement>(null)
  const previous = useRef(selected)
  const contents = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (previous.current === selected) return
    previous.current = selected
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView({ block: "start", behavior: "instant" })
  }, [selected])
  const report = record.report
  if (!report) return null
  const sections = [...report.sections].sort((a, b) => a.id === "conclusion" ? -1 : b.id === "conclusion" ? 1 : 0)
  const section = sections.find(section => section.id === selected) ?? sections[0]
  if (!section) return null
  const coverage = report.coverage
  const navigation = <nav aria-label={t.workspaceContents}><ol>{sections.map((chapter, index) => <li key={chapter.id}>
    <button type="button" aria-current={section.id === chapter.id ? "page" : undefined} onClick={() => {
      setEvidence(undefined); setSelected(chapter.id); if (contents.current) contents.current.open = false
    }}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{analysisLabel(chapter.id, t)}</button>
  </li>)}</ol></nav>
  return <section className="report-reading-layout" aria-label={t.analysisBoard}>
    <aside className="report-contents"><p className="workspace-eyebrow">{t.workspaceContents}</p>{navigation}</aside>
    <details ref={contents} className="report-contents-mobile"><summary>{t.workspaceContents} · {analysisLabel(section.id, t)}</summary>{navigation}</details>
    <article className="report-reading-document" aria-label={analysisLabel(section.id, t)}>
      <header className="report-chapter-heading"><p className="workspace-eyebrow">{t.workspaceAnalysis}</p>
        <h2 ref={heading} tabIndex={-1}>{analysisLabel(section.id, t)}</h2>
      </header>
      {section.status === "ready" ? <AnalysisSectionDetail section={section} t={t} onEvidence={(id, trigger) => setEvidence({ id, trigger })} /> : <p role="status">{t.analysisFailed}</p>}
      {section.id === "trajectories" ? <section className="report-distribution" aria-label={t.analysisTrajectories}>
        {report.trajectories.categories.map(category => <p key={category.id}><MarkdownContent generated inline content={category.label} /> — {t.analysisFrequency.replace("{count}", String(category.worldIds.length)).replace("{total}", String(coverage.analyzed))}</p>)}
        <p>{t.analysisUnclassified.replace("{count}", String(report.trajectories.unclassifiedWorldIds.length))}</p>
      </section> : null}
      <p className="report-reading-note">{t.analysisSimulationScope}</p>
    </article>
    <aside className="report-scope" aria-label={t.workspaceScope}>
      <h3>{t.workspaceScope}</h3>
      <dl><dt>{t.analysisPerspective}</dt><dd><MarkdownContent generated content={report.perspective.focus} /></dd>
        <dt>{t.analysisObjectiveTask}</dt><dd><MarkdownContent generated content={report.perspective.objective} /></dd>
        <dt>{t.analysisExportHorizon}</dt><dd><MarkdownContent generated content={report.perspective.horizon} /></dd>
        <dt>{t.analysisExportBoundary}</dt><dd><MarkdownContent generated content={report.perspective.boundary} /></dd></dl>
      <p className="report-reading-note">{t.analysisCoverage.replace("{completed}", String(coverage.completed)).replace("{requested}", String(coverage.requested)).replace("{analyzed}", String(coverage.analyzed))}</p>
      <p className="text-xs text-muted-foreground">{t.analysisMissing.replace("{failed}", String(coverage.failed)).replace("{canceled}", String(coverage.canceled)).replace("{interrupted}", String(coverage.interrupted))}</p>
      {evidence ? <ReportEvidencePanel key={evidence.id} reportId={record.id} referenceId={evidence.id} t={t} onClose={() => {
        evidence.trigger.focus({ preventScroll: true }); setEvidence(undefined)
      }} /> : null}
    </aside>
  </section>
}
