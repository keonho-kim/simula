/**
 * Purpose: Retain the most recently prepared world identity for a confirmed scenario.
 * Pattern: Browser persistence adapter.
 * Usage: Called by the per-world launch hook.
 * Related: src/ui/hooks/use-world-preparation.ts
 */
import { z } from "zod"

const KEY = "simula.world-preparation"
const schema = z.object({ scenarioId: z.uuid(), worldId: z.uuid() })

export function readWorldSession(scenarioId: string): string | undefined {
  try {
    const value = schema.safeParse(JSON.parse(sessionStorage.getItem(KEY) ?? "null"))
    return value.success && value.data.scenarioId === scenarioId ? value.data.worldId : undefined
  } catch { return undefined }
}

export function writeWorldSession(scenarioId: string, worldId?: string): void {
  if (!worldId) { sessionStorage.removeItem(KEY); return }
  sessionStorage.setItem(KEY, JSON.stringify(schema.parse({ scenarioId, worldId })))
}
