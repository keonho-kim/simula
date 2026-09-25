/**
 * Purpose: Separate ordinary provider settings from credentials at the storage boundary.
 * Pattern: Pure Transformation.
 * Usage: Called before settings writes and after vault unlock.
 * Related: src/ui/browser-storage/database/settings/save.ts, src/ui/browser-storage/database/credential-vault.ts
 */
import type { LLMSettings, ModelProvider } from "@/shared"
import type { ProviderSecrets } from "../credential-vault"

export function separateProviderSecrets(settings: LLMSettings): { ordinary: LLMSettings; secrets: ProviderSecrets } {
  const ordinary = structuredClone(settings)
  const secrets: ProviderSecrets = {}
  for (const provider of Object.keys(ordinary.providers) as ModelProvider[]) {
    const connection = ordinary.providers[provider]
    secrets[provider] = { apiKey: connection.apiKey, extraHeaders: connection.extraHeaders }
    delete connection.apiKey
    delete connection.extraHeaders
  }
  return { ordinary, secrets }
}

export function restoreProviderSecrets(ordinary: LLMSettings, secrets: ProviderSecrets): LLMSettings {
  const restored = structuredClone(ordinary)
  for (const provider of Object.keys(restored.providers) as ModelProvider[]) {
    restored.providers[provider] = { ...restored.providers[provider], ...secrets[provider] }
  }
  return restored
}
