/**
 * Purpose: Read one bundled sample scenario and its controls.
 * Pattern: Repository Query.
 * Usage: Called when the user opens a sample scenario.
 * Related: src/ui/browser-storage/database/samples/seed-version.ts, src/ui/browser-storage/database/samples/title.ts
 */
import type { ScenarioSampleDetail } from "@/shared"
import { and, eq } from "drizzle-orm"
import { scenarios } from "../browser-schema"
import { browserOrm } from "../orm"
import { SAMPLE_SEED_VERSION } from "./seed-version"
import { titleFromText } from "./title"

export async function readSample(name: string): Promise<ScenarioSampleDetail | undefined> {
  const [row] = await browserOrm.select({ sourceName: scenarios.sourceName, text: scenarios.text,
    controlsJson: scenarios.controlsJson }).from(scenarios).where(and(
      eq(scenarios.id, `sample:${SAMPLE_SEED_VERSION}:${name}`), eq(scenarios.origin, "sample")))
  if (!row) return undefined
  return { name: row.sourceName, title: titleFromText(row.text, row.sourceName), text: row.text,
    controls: JSON.parse(row.controlsJson) as ScenarioSampleDetail["controls"] }
}
