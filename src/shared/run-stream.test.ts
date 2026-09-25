/**
 * Purpose: Verify transport scope, event-kind and cursor validation without runtime-specific dependencies.
 * Pattern: Shared boundary contract tests.
 * Usage: bun test src/shared/run-stream.test.ts
 * Related: src/shared/run-stream.ts
 */
import { expect, test } from "bun:test"
import { parseRunCursor, parseRunEventEnvelope } from "./run-stream"

test("run stream envelopes require known event identity and preserve domain payloads", () => {
  const event = { type: "log", runId: "run", timestamp: "now", level: "info", message: "preserved" } as const
  expect(parseRunEventEnvelope(event, "run")).toBe(event)
  for (const invalid of [null, [], {}, { ...event, type: "script" }, { ...event, timestamp: 1 }]) {
    expect(() => parseRunEventEnvelope(invalid, "run")).toThrow("envelope")
  }
  expect(() => parseRunEventEnvelope(event, "other")).toThrow("scope")
})

test("byte cursors cannot cross runs or accept ambiguous and unsafe offsets", () => {
  expect(parseRunCursor(undefined, "run")).toBe(0)
  expect(parseRunCursor("run:135", "run")).toBe(135)
  for (const invalid of ["other:135", "run:-1", "run:1.5", "run:01", "run:1e2", "run:9007199254740992"]) {
    expect(() => parseRunCursor(invalid, "run")).toThrow("cursor")
  }
})
