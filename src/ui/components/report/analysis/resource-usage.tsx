/**
 * Purpose: Show recorded model usage by shared, world, and final-analysis scope.
 * Pattern: Read-only report presentation.
 * Usage: Rendered for a terminal analytical report after accounting loads.
 * Related: src/shared/analytical-report.ts, src/ui/components/report/analysis/workspace.tsx
 */
import type { ResourceAccounting, ResourceUsage } from "@/shared/analytical-report"
import type { UiTexts } from "@/ui/types/i18n"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/components/ui/card"

export function ResourceUsagePanel({ accounting, language, t }: {
  accounting: ResourceAccounting; language: "en" | "ko"; t: UiTexts
}) {
  const number = new Intl.NumberFormat(language)
  const formatted = (value: number | null | undefined) => value === null || value === undefined ? "—" : number.format(value)
  const calls = (usage: ResourceUsage | null) => usage?.calls === null && usage.observedCalls
    ? `— (${t.analysisObservedCalls.replace("{count}", number.format(usage.observedCalls))})` : formatted(usage?.calls)
  const scopes: Array<{ label: string; usage: ResourceUsage | null }> = [
    { label: t.analysisSharedUsage, usage: accounting.sharedPreparation },
    { label: t.analysisWorldTotal, usage: accounting.worldTotal },
    { label: t.analysisFinalUsage, usage: accounting.analysisGeneration },
    { label: t.analysisOverallUsage, usage: accounting.overall },
  ]
  return <Card size="sm" role="region" aria-label={t.analysisResourceUsage}>
    <CardHeader><CardTitle>{t.analysisResourceUsage}</CardTitle><CardDescription>{t.analysisRecordedOnly}</CardDescription></CardHeader>
    <CardContent className="flex min-w-0 flex-col gap-3">
      <dl className="flex min-w-0 flex-wrap gap-3">
        {scopes.map(scope => <div key={scope.label} className="min-w-0 flex-[1_1_180px]">
          <dt className="text-xs text-muted-foreground">{scope.label}</dt>
          <dd className="font-medium">{t.analysisCallCount} {calls(scope.usage)} · {t.analysisExportTokens} {formatted(scope.usage?.totalTokens)}</dd>
        </div>)}
      </dl>
      {accounting.worlds.length > 1 ? <div aria-label={t.analysisWorldTotal}>
        <ul className="flex flex-col gap-1 text-xs">
          {accounting.worlds.map((world, index) => <li key={world.worldId} className="flex min-w-0 justify-between gap-3">
            <span className="truncate" title={world.worldId}>{t.analysisWorldUsage.replace("{id}", number.format(index + 1))}</span>
            <span className="shrink-0 text-muted-foreground">{t.analysisCallCount} {calls(world.usage)} · {t.analysisExportTokens} {formatted(world.usage.totalTokens)}</span>
          </li>)}
        </ul>
      </div> : null}
    </CardContent>
  </Card>
}
