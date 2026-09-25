/**
 * Purpose: Verify persisted model concurrency defaults and input bounds.
 * Pattern: Settings contract test.
 * Usage: bun test src/backend/core/settings/concurrency.test.ts
 * Related: src/backend/core/settings/normalize.ts, src/backend/runtime/model-admission.ts
 */
import { expect, test } from "bun:test"
import { defaultSettings } from "./defaults"
import { normalizeSettings } from "./normalize"

test("concurrency is persisted in structured settings and defaults for older settings", () => {
  expect(normalizeSettings({}).concurrency).toBe(8)
  expect(normalizeSettings({ ...defaultSettings(), concurrency: 3 }).concurrency).toBe(3)
  expect(normalizeSettings({ concurrency: 50 }).concurrency).toBe(50)
})

test("invalid concurrency is rejected instead of silently replaced", () => {
  for (const concurrency of [0, 1.5, 51, Number.NaN]) {
    expect(() => normalizeSettings({ concurrency })).toThrow("between 1 and 50")
  }
})
