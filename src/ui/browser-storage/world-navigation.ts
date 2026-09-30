/**
 * Purpose: Remember the source list of an opened world and restore its owning workflow.
 * Pattern: Browser session adapter.
 * Usage: Written by MultiversePanel and read by run navigation and returning world lists.
 * Related: src/ui/browser-storage/multiverse-session.ts, src/ui/browser-storage/scenario-builder-session.ts
 */
import { z } from "zod"
import { readDocumentScenarioSession, writeDocumentScenarioSession } from "./scenario-builder-session"
import { writeMultiverseSession } from "./multiverse-session"

const KEY = "simula.world-navigation"
const schema = z.object({ scenarioId: z.uuid(), batchId: z.uuid(), worldId: z.uuid(), runId: z.string() }).strict()
  .refine(value => value.runId === `world-${value.worldId}`, "Run must belong to the selected world.")
type WorldVisit = z.infer<typeof schema>

export function rememberWorldVisit(value: WorldVisit): void {
  sessionStorage.setItem(KEY, JSON.stringify(schema.parse(value)))
}
export function readWorldVisit(): WorldVisit | undefined {
  try {
    const parsed = schema.safeParse(JSON.parse(sessionStorage.getItem(KEY) ?? "null"))
    return parsed.success ? parsed.data : undefined
  } catch { return undefined }
}
export function restoreWorldList(runId: string): boolean {
  const visit = readWorldVisit()
  if (!visit || visit.runId !== runId) return false
  const current = readDocumentScenarioSession()
  writeDocumentScenarioSession({ ...(current.buildId === visit.scenarioId ? current : {}),
    buildId: visit.scenarioId, pendingGeneration: false })
  writeMultiverseSession(visit.scenarioId, visit.batchId)
  return true
}
