import type { ModelProvider, ProviderSettings } from "@simula/shared"

const MODEL_CACHE_PREFIX = "simula.provider-models.v1"

export function providerModelsCacheKey(provider: ModelProvider, connection: ProviderSettings): string {
  return `${MODEL_CACHE_PREFIX}:${stableJson({
    provider,
    baseUrl: connection.baseUrl?.trim() ?? "",
    apiKey: connection.apiKey?.trim() ? "set" : "empty",
    extraHeaders: connection.extraHeaders ?? {},
  })}`
}

export function readProviderModelsCache(cacheKey: string): string[] | undefined {
  const storage = sessionStorageOrUndefined()
  if (!storage) {
    return undefined
  }
  try {
    const cached = storage.getItem(cacheKey)
    if (!cached) {
      return undefined
    }
    const parsed = JSON.parse(cached) as { models?: unknown }
    return Array.isArray(parsed.models)
      ? parsed.models.filter((model): model is string => typeof model === "string")
      : undefined
  } catch {
    return undefined
  }
}

export function writeProviderModelsCache(cacheKey: string, models: string[]): void {
  const storage = sessionStorageOrUndefined()
  if (!storage) {
    return
  }
  try {
    storage.setItem(cacheKey, JSON.stringify({ models }))
  } catch {
    return
  }
}

function sessionStorageOrUndefined(): Storage | undefined {
  return typeof sessionStorage === "undefined" ? undefined : sessionStorage
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value))
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson)
  }
  if (!value || typeof value !== "object") {
    return value
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortJson(child)])
  )
}
