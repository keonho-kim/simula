/**
 * Purpose: Record that the current bundled sample generation is present.
 * Pattern: Repository Query.
 * Usage: Called after all bundled sample writes succeed.
 * Related: src/ui/browser-storage/database/samples/seed-version.ts, src/ui/browser-storage/database/samples/seed-is-current.ts
 */
import { appMeta } from "../browser-schema"
import { browserOrm } from "../orm"
import { SAMPLE_SEED_VERSION } from "./seed-version"

export async function markSampleSeedCurrent(): Promise<void> {
  await browserOrm.insert(appMeta).values({ key: "sample_seed_version", value: SAMPLE_SEED_VERSION })
    .onConflictDoUpdate({ target: appMeta.key, set: { value: SAMPLE_SEED_VERSION } })
}
