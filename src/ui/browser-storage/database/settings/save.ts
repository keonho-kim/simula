/**
 * Purpose: Upsert ordinary model settings after removing provider credentials.
 * Pattern: Repository Query.
 * Usage: Called by the settings editor after a valid change.
 * Related: src/ui/browser-storage/database/settings/secrets.ts, src/ui/browser-storage/database/browser-schema.ts
 */
import type { LLMSettings } from "@/shared"
import { settings } from "../browser-schema"
import { browserOrm } from "../orm"
import { separateProviderSecrets } from "./secrets"

export async function saveOrdinarySettings(value: LLMSettings): Promise<void> {
  const { ordinary } = separateProviderSecrets(value)
  const valueJson = JSON.stringify(ordinary), updatedAt = new Date().toISOString()
  await browserOrm.insert(settings).values({ id: 1, valueJson, updatedAt })
    .onConflictDoUpdate({ target: settings.id, set: { valueJson, updatedAt } })
}
