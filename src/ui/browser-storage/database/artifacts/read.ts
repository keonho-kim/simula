/**
 * Purpose: Read one browser-owned generation artifact by kind and ID.
 * Pattern: Repository Query.
 * Usage: Called by browser API adapters for offline or resumed results.
 * Related: src/ui/browser-storage/database/artifact-schema.ts, src/ui/browser-storage/database/artifacts/save.ts
 */
import { eq } from "drizzle-orm"
import { artifacts } from "../artifact-schema"
import { browserOrm } from "../orm"

export async function readBrowserArtifact<T>(kind: string, id: string): Promise<T | undefined> {
  const [row] = await browserOrm.select({ valueJson: artifacts.valueJson }).from(artifacts)
    .where(eq(artifacts.id, `${kind}:${id}`))
  return row ? JSON.parse(row.valueJson) as T : undefined
}
