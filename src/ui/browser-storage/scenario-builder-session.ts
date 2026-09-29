/**
 * Purpose: Retain document/build identifiers, active generation intent, and its language within the tab.
 * Pattern: Browser persistence adapter.
 * Usage: Called by the document scenario lifecycle hook.
 * Related: src/ui/hooks/use-document-scenario.ts
 */
import { z } from "zod"

const KEY = "simula.document-scenario"
const schema = z.object({ documentSetId: z.uuid().optional(), buildId: z.uuid().optional(), pendingGeneration: z.boolean().optional(), language: z.enum(["ko", "en"]).optional() })
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
