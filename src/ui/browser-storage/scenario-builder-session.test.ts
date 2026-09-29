/**
 * Purpose: Verify document analysis resumes its generation intent and language after reload.
 * Pattern: Session adapter contract test.
 * Usage: Executed by bun test.
 * Related: src/ui/browser-storage/scenario-builder-session.ts
 */
import { expect, test } from "bun:test"
import { readDocumentScenarioSession, writeDocumentScenarioSession } from "./scenario-builder-session"

test("session restores pending analysis and its chosen language without file bodies", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage")
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value),
  } })
  try {
    const session = { documentSetId: "11111111-1111-4111-8111-111111111111", pendingGeneration: true, language: "ko" as const }
    writeDocumentScenarioSession(session)
    expect(readDocumentScenarioSession()).toEqual(session)
    writeDocumentScenarioSession({ documentSetId: session.documentSetId })
    expect(readDocumentScenarioSession()).toEqual({ documentSetId: session.documentSetId })
  } finally {
    if (original) Object.defineProperty(globalThis, "sessionStorage", original)
    else Reflect.deleteProperty(globalThis, "sessionStorage")
  }
})
