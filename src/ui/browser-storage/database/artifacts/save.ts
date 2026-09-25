/**
 * Purpose: Upsert one browser-owned generation artifact.
 * Pattern: Repository Query.
 * Usage: Called after a document, builder, world, or analysis response.
 * Related: src/ui/browser-storage/database/artifact-schema.ts, src/ui/browser-storage/database/artifacts/read.ts
 */
import { artifacts } from "../artifact-schema"
import { browserOrm } from "../orm"

export async function saveBrowserArtifact<T>(kind: string, id: string, ownerId: string, status: string, value: T): Promise<T> {
  const valueJson = JSON.stringify(value), updatedAt = new Date().toISOString()
  await browserOrm.insert(artifacts).values({ id: `${kind}:${id}`, kind, ownerId, status, valueJson, updatedAt })
    .onConflictDoUpdate({ target: artifacts.id, set: { status, valueJson, updatedAt } })
  return value
}
