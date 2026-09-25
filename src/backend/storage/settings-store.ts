/**
 * Purpose: Hold model settings only for active server work without disk persistence.
 * Pattern: Process-scoped settings adapter.
 * Usage: Updated by the browser session before model calls and read by active workflows.
 * Related: src/backend/core/settings/normalize.ts, src/ui/browser-storage/database/settings/read.ts
 */
import type { LLMSettings, ModelProvider } from "@/shared"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { normalizeSettings } from "@/backend/core/settings/normalize"
import { AsyncLocalStorage } from "node:async_hooks"

const sessionContext = new AsyncLocalStorage<string>()
const settingsBySession = new Map<string, LLMSettings>()
const LOCAL_SESSION = "local"

export function withSettingsSession<T>(sessionId: string, operation: () => T): T {
  return sessionContext.run(sessionId, operation)
}

export function forgetSessionSettings(sessionId: string): void {
  settingsBySession.delete(sessionId)
}

export async function readSettings(): Promise<LLMSettings> {
  return structuredClone(settingsBySession.get(sessionContext.getStore() ?? LOCAL_SESSION) ?? defaultSettings())
}

export async function writeSettings(settings: LLMSettings): Promise<void> {
  const sessionId = sessionContext.getStore() ?? LOCAL_SESSION
  const current = settingsBySession.get(sessionId) ?? defaultSettings()
  const merged = normalizeSettings(settings)
  for (const provider of Object.keys(merged.providers) as ModelProvider[]) {
    const connection = merged.providers[provider]
    if (connection.apiKey === "********") connection.apiKey = current.providers[provider].apiKey
    connection.extraHeaders = mergeRetainedHeaders(connection.extraHeaders, current.providers[provider].extraHeaders)
  }
  settingsBySession.set(sessionId, merged)
}

export function mergeRetainedHeaders(
  next: Record<string, string> | undefined,
  previous: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!next) return undefined
  return Object.fromEntries(Object.entries(next).map(([key, value]) => [
    key, value === "********" ? previous?.[key] ?? "" : value,
  ]))
}
