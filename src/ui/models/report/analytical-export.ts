/**
 * Purpose: Render one accepted analytical snapshot as safe, localized Markdown.
 * Pattern: Pure report projection.
 * Usage: Called after the validated JSON export has been fetched by the browser.
 * Related: src/shared/analytical-report.ts, src/ui/models/report/reference-location.ts
 */
import type { AnalyticalExport, AnalysisSection, ResourceUsage } from "@/shared/analytical-report"
import type { UiTexts } from "@/ui/types/i18n"
import { analysisLabel } from "./analytical-view"
import { builderLabel } from "@/ui/models/scenario-builder/labels"
import { referenceLocation } from "./reference-location"

// Model and source text is data; escape Markdown controls before placing it in a portable file.
function literal(value: string): string {
  return value.replace(/\r\n?/g, "\n")
    .replace(/[\\`*_{}[\]()!<>|~]/g, "\\$&")
    .replace(/:\/\//g, ":\\/\\/")
    .replace(/^([ \t]*)(#{1,6}\s|>\s|[-+]\s|\d+[.)]\s)/gm, (_line, indent: string, prefix: string) => `${indent}\\${prefix}`)
}
function sectionLines(section: AnalysisSection, t: UiTexts): string[] {
  const lines = [`## ${analysisLabel(section.id, t)}`, ""]
  if (section.status === "failed") return [...lines, t.analysisFailed, ""]
  lines.push(literal(section.summary), "")
  if (section.score) lines.push(`${t.analysisRubric} ${section.score.value ?? t.analysisUnknown}`, literal(section.score.rationale), "")
  lines.push(literal(section.content), "")
  if (section.findings.length) {
    lines.push(`### ${t.reportDetailedItems}`, "")
    for (const finding of section.findings) {
      const provenance = finding.provenance?.map(category => analysisLabel(category, t)).join(" · ")
      lines.push(`- ${provenance ? `${literal(provenance)} — ` : ""}${literal(finding.text)} (${finding.evidenceIds.map(literal).join(", ")})`)
    }
    lines.push("")
  }
  if (section.evidenceIds.length) lines.push(`${t.reportEvidence}: ${section.evidenceIds.map(literal).join(", ")}`, "")
  return lines
}
export function renderAnalyticalMarkdown(artifact: AnalyticalExport, t: UiTexts): string {
  const { report, references } = artifact
  const coverage = report.coverage
  const freshness = artifact.freshness === "current" ? t.builderStatusReady : artifact.freshness === "outdated" ? t.analysisOutdated : t.analysisSourceUnavailable
  const ordered = [report.sections.find(section => section.id === "conclusion"), ...report.sections.filter(section => section.id !== "conclusion")].filter((section): section is AnalysisSection => !!section)
  const lines = [`# ${t.analysisBoard}`, "", `- ${t.analysisExportRevision}: ${artifact.inputRevision}`,
    `- ${t.analysisExportStatus}: ${builderLabel(artifact.executionStatus, t)}`,
    `- ${t.analysisExportFreshness}: ${freshness}`,
    `- ${t.analysisPerspective}: ${literal(report.perspective.focus)} · ${literal(report.perspective.objective)}`,
    `- ${t.analysisExportHorizon}: ${literal(report.perspective.horizon)}`,
    `- ${t.analysisExportBoundary}: ${literal(report.perspective.boundary)}`,
    `- ${t.analysisCoverage.replace("{requested}", String(coverage.requested)).replace("{completed}", String(coverage.completed)).replace("{analyzed}", String(coverage.analyzed))}`,
    `- ${t.analysisMissing.replace("{failed}", String(coverage.failed)).replace("{canceled}", String(coverage.canceled)).replace("{interrupted}", String(coverage.interrupted))}`,
    "", ...ordered.flatMap(section => sectionLines(section, t))]
  if (report.unavailableInputs.length) lines.push(`## ${t.analysisPartial}`, "", ...report.unavailableInputs.map(value => `- ${literal(value)}`), "")
  lines.push(`## ${t.analysisTrajectories}`, "")
  for (const category of report.trajectories.categories) lines.push(`- ${literal(category.label)} — ${t.analysisFrequency.replace("{count}", String(category.worldIds.length)).replace("{total}", String(coverage.analyzed))}: ${category.worldIds.map(literal).join(", ")}`)
  lines.push(`- ${t.analysisUnclassified.replace("{count}", String(report.trajectories.unclassifiedWorldIds.length))}`, "")
  lines.push(`## ${t.reportEvidence}`, "")
  for (const [index, reference] of references.entries()) {
    lines.push(`### ${t.analysisExportReference.replace("{index}", String(index + 1))}`, "",
      `${analysisLabel(reference.category, t)} · ${literal(referenceLocation(reference, t))}`, "",
      `${literal(reference.id)}: ${literal(reference.text)}`, "")
  }
  const number = new Intl.NumberFormat(artifact.language)
  const usageLine = (label: string, usage: ResourceUsage | null): string => {
    const calls = usage?.calls === null || usage === null ? "—" : number.format(usage.calls)
    const observed = usage?.calls === null && usage.observedCalls
      ? ` (${t.analysisObservedCalls.replace("{count}", number.format(usage.observedCalls))})` : ""
    const tokens = usage?.totalTokens === null || usage === null ? "—" : number.format(usage.totalTokens)
    return `- ${label}: ${t.analysisCallCount} ${calls}${observed} · ${t.analysisExportTokens} ${tokens}`
  }
  lines.push(`## ${t.analysisResourceUsage}`, "",
    usageLine(t.analysisSharedUsage, artifact.accounting.sharedPreparation),
    usageLine(t.analysisWorldTotal, artifact.accounting.worldTotal))
  for (const world of artifact.accounting.worlds) lines.push(usageLine(t.analysisWorldUsage.replace("{id}", world.worldId), world.usage))
  lines.push(usageLine(t.analysisFinalUsage, artifact.accounting.analysisGeneration),
    usageLine(t.analysisOverallUsage, artifact.accounting.overall), "")
  lines.push(`## ${t.analysisExportCalls}`, "")
  for (const call of artifact.metrics) {
    const tokens = call.metrics.tokenSource === "provider" ? String(call.metrics.totalTokens) : "—"
    lines.push(`- ${call.timestamp}: ${t.ttft} ${call.metrics.ttftMs} ms · ${t.duration} ${call.metrics.durationMs} ms · ${t.analysisExportTokens} ${tokens}`)
  }
  return `${lines.join("\n")}\n`
}
