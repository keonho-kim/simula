/**
 * Purpose: Upsert one bundled sample without changing its user-owned peers.
 * Pattern: Repository Query.
 * Usage: Called while seeding examples into browser storage.
 * Related: src/ui/browser-storage/database/samples/seed-version.ts, src/ui/browser-storage/database/browser-schema.ts
 */
import type { ScenarioSampleDetail } from "@/shared"
import { scenarios } from "../browser-schema"
import { browserOrm } from "../orm"
import { SAMPLE_SEED_VERSION } from "./seed-version"

export async function saveSample(sample: ScenarioSampleDetail): Promise<void> {
  const controlsJson = JSON.stringify(sample.controls), updatedAt = new Date().toISOString()
  await browserOrm.insert(scenarios).values({ id: `sample:${SAMPLE_SEED_VERSION}:${sample.name}`,
    origin: "sample", seedVersion: SAMPLE_SEED_VERSION, sourceName: sample.name, text: sample.text,
    controlsJson, updatedAt }).onConflictDoUpdate({ target: scenarios.id,
    set: { text: sample.text, controlsJson, updatedAt } })
}
