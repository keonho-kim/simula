/**
 * Purpose: Render one accepted analytical chapter and its evidence controls.
 * Pattern: Read-only presentation.
 * Usage: Mounted only for the selected report chapter.
 * Related: src/ui/components/report/analysis/report-tabs.tsx, src/ui/components/report/analysis/evidence-panel.tsx
 */
import type { AnalysisSection } from "@/shared/analytical-report"
import type { UiTexts } from "@/ui/types/i18n"
import { analysisLabel } from "@/ui/models/report/analytical-view"
import { MarkdownContent } from "@/ui/components/markdown/markdown-content"
import { Button } from "@/ui/components/ui/button"

export function AnalysisSectionDetail({ section, t, onEvidence }: {
  section: AnalysisSection; t: UiTexts; onEvidence: (id: string, trigger: HTMLButtonElement) => void
}) {
  const ids = [...new Set([...section.evidenceIds, ...section.findings.flatMap(finding => finding.evidenceIds), ...(section.score?.evidenceIds ?? [])])]
  return <div className="report-chapter-content">
    <MarkdownContent density="report" generated className="report-reading-lead" content={section.summary} />
    <MarkdownContent density="report" generated content={section.content} />
    {section.findings.length ? <section><h3>{t.reportDetailedItems}</h3><ul className="flex list-disc flex-col gap-4 pl-5">{section.findings.map((finding, index) => <li key={index}>
      {finding.provenance?.length ? <span className="mb-2 inline-block text-xs font-medium text-muted-foreground">{finding.provenance.map(category => analysisLabel(category, t)).join(" · ")}</span> : null}
      <MarkdownContent density="report" generated content={finding.text} />
    </li>)}</ul></section> : null}
    {ids.length ? <section className="report-evidence-links"><h3>{t.reportEvidence}</h3>
      <div className="flex flex-wrap gap-2">{ids.map((id, index) => <Button key={id} variant="outline" size="sm"
        onClick={event => onEvidence(id, event.currentTarget)}>{t.reportEvidence} {index + 1}</Button>)}</div>
    </section> : null}
  </div>
}
