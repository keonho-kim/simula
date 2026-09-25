/**
 * Purpose: Read ordinary model settings from browser SQLite.
 * Pattern: Repository Query.
 * Usage: Called during settings initialization and run preparation.
 * Related: src/ui/browser-storage/database/settings/save.ts, src/ui/browser-storage/database/browser-schema.ts
 */
import type { LLMSettings } from "@/shared"
import { eq } from "drizzle-orm"
import { settings } from "../browser-schema"
import { browserOrm } from "../orm"

export async function readLocalSettings(): Promise<LLMSettings | undefined> {
  const [row] = await browserOrm.select({ valueJson: settings.valueJson }).from(settings)
    .where(eq(settings.id, 1))
  return row ? JSON.parse(row.valueJson) as LLMSettings : undefined
}
