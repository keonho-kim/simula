/**
 * Purpose: Summarize actual batch progress before the user selects a simulation.
 * Pattern: Read-only lifecycle overview.
 * Usage: Rendered by MultiversePanel using the existing compact batch response.
 * Related: src/ui/components/multiverse/batch-world-status.ts, src/shared/multiverse.ts
 */
import type { MultiverseRecord } from "@/shared/multiverse"
import type { UiTexts } from "@/ui/types/i18n"
import { Badge } from "@/ui/components/ui/badge"
import { batchStatusText, isActiveSimulation } from "./batch-world-status"

export function BatchOverview({ batch, language, t }: { batch: MultiverseRecord; language: "en" | "ko"; t: UiTexts }) {
  const number = new Intl.NumberFormat(language)
  const count = (...statuses: string[]) => batch.worlds.filter(world => statuses.includes(world.status)).length
  const attentionCount = batch.worlds.filter(world => world.status === "failed" || world.status === "interrupted" || world.status === "waiting" && !world.autoContinue).length
  const totals = [[t.simulationsTotal, batch.worlds.length], [t.simulationsActive, batch.worlds.filter(world => isActiveSimulation(world.status)).length],
    [t.batchCompleted, count("completed")], [t.simulationsAttention, attentionCount]] as const
  return <section className="simulation-overview" aria-label={t.simulationsOverview}>
    <header><h2>{t.simulationsOverview}</h2><Badge variant="secondary" data-status={batch.status}>{batchStatusText(batch.status, t)}</Badge></header>
    <dl>{totals.map(([label, total]) => <div key={label}><dt>{label}</dt><dd>{number.format(total)}</dd></div>)}</dl>
    <p role="status">{t.batchSummary.replace("{total}", number.format(batch.worlds.length)).replace("{completed}", number.format(count("completed")))
      .replace("{failed}", number.format(count("failed"))).replace("{canceled}", number.format(count("canceled"))).replace("{interrupted}", number.format(count("interrupted")))}</p>
  </section>
}
