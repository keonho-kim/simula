/**
 * Purpose: Retain only document/build identifiers for reopening a scenario workflow.
 * Pattern: Browser persistence adapter.
 * Usage: Called by the document scenario lifecycle hook.
 * Related: src/ui/hooks/use-document-scenario.ts
 */
import { z } from "zod"

const KEY = "simula.document-scenario"
const schema = z.object({ documentSetId: z.uuid().optional(), buildId: z.uuid().optional() })
export type DocumentScenarioSession = z.infer<typeof schema>

export function readDocumentScenarioSession(): DocumentScenarioSession {
  try {
    const result = schema.safeParse(JSON.parse(sessionStorage.getItem(KEY) ?? "{}"))
    return result.success ? result.data : {}
  } catch { return {} }
}

export function writeDocumentScenarioSession(value: DocumentScenarioSession): void {
  sessionStorage.setItem(KEY, JSON.stringify(schema.parse(value)))
}
