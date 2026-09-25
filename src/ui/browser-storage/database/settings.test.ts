/**
 * Purpose: Verify ordinary settings never carry provider secrets into SQLite rows.
 * Pattern: Pure boundary contract test.
 * Usage: bun test src/ui/browser-storage/database/settings.test.ts
 * Related: src/ui/browser-storage/database/settings/secrets.ts
 */
import { expect, test } from "bun:test"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { restoreProviderSecrets, separateProviderSecrets } from "./settings/secrets"

test("provider keys and headers are removed from ordinary settings and restored after unlock", () => {
  const input = defaultSettings()
  input.concurrency = 4
  input.providers.openai = { apiKey: "secret", extraHeaders: { Authorization: "Bearer secret" } }
  const { ordinary, secrets } = separateProviderSecrets(input)
  expect(JSON.stringify(ordinary)).not.toContain("secret")
  expect(JSON.stringify(secrets)).toContain("secret")
  expect(restoreProviderSecrets(ordinary, secrets).providers.openai).toEqual(input.providers.openai)
})
