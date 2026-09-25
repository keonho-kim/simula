/**
 * Purpose: Check whether bundled samples match the current seed version.
 * Pattern: Repository Query.
 * Usage: Called before fetching and storing sample scenarios.
 * Related: src/ui/browser-storage/database/samples/seed-version.ts, src/ui/browser-storage/database/samples/mark-seed-current.ts
 */
import { eq } from "drizzle-orm"
import { appMeta } from "../browser-schema"
import { browserOrm } from "../orm"
import { SAMPLE_SEED_VERSION } from "./seed-version"

export async function sampleSeedIsCurrent(): Promise<boolean> {
  const [row] = await browserOrm.select({ value: appMeta.value }).from(appMeta)
    .where(eq(appMeta.key, "sample_seed_version"))
  return row?.value === SAMPLE_SEED_VERSION
}
