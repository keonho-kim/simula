/**
 * Purpose: List the current generation of bundled sample summaries.
 * Pattern: Repository Query.
 * Usage: Called by the landing page's sample picker.
 * Related: src/ui/browser-storage/database/samples/seed-version.ts, src/ui/browser-storage/database/samples/title.ts
 */
import type { ScenarioSampleSummary } from "@/shared"
import { and, eq } from "drizzle-orm"
import { scenarios } from "../browser-schema"
import { browserOrm } from "../orm"
import { SAMPLE_SEED_VERSION } from "./seed-version"
import { titleFromText } from "./title"

export async function listSavedSamples(): Promise<ScenarioSampleSummary[]> {
  const rows = await browserOrm.select({ sourceName: scenarios.sourceName, text: scenarios.text,
    controlsJson: scenarios.controlsJson }).from(scenarios).where(and(
      eq(scenarios.origin, "sample"), eq(scenarios.seedVersion, SAMPLE_SEED_VERSION)))
    .orderBy(scenarios.sourceName)
  return rows.map(row => ({ name: row.sourceName, title: titleFromText(row.text, row.sourceName),
    controls: JSON.parse(row.controlsJson) as ScenarioSampleSummary["controls"] }))
}
