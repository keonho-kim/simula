/**
 * Purpose: Retain the current batch identity without duplicating world state in browser storage.
 * Pattern: Browser persistence adapter.
 * Usage: Called by world launch and Multiverse workflow hooks.
 * Related: src/ui/hooks/use-multiverse.ts
 */
import { z } from "zod"

const KEY = "simula.multiverse-session"
const schema = z.object({ scenarioId: z.uuid(), batchId: z.uuid() })
export function readMultiverseSession(scenarioId: string): string | undefined {
  try {
    const parsed = schema.safeParse(JSON.parse(sessionStorage.getItem(KEY) ?? "null"))
    return parsed.success && parsed.data.scenarioId === scenarioId ? parsed.data.batchId : undefined
  } catch { return undefined }
}
export function writeMultiverseSession(scenarioId: string, batchId?: string): void {
  if (!batchId) { sessionStorage.removeItem(KEY); return }
  sessionStorage.setItem(KEY, JSON.stringify(schema.parse({ scenarioId, batchId })))
}
