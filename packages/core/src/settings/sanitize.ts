import type { LLMSettings } from "@simula/shared"
import { MODEL_PROVIDERS } from "./constants"
import { normalizeSettings } from "./normalize"

export function sanitizeSettings(settings: LLMSettings): LLMSettings {
  const normalized = normalizeSettings(settings)
  return {
    ...normalized,
    providers: Object.fromEntries(
      MODEL_PROVIDERS.map((provider) => {
        const value = normalized.providers[provider]
        return [
          provider,
          {
            ...value,
            apiKey: value.apiKey ? "********" : "",
            extraHeaders: value.extraHeaders ? maskHeaders(value.extraHeaders) : undefined,
          },
        ]
      })
    ) as LLMSettings["providers"],
  }
}

function maskHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      /^(authorization|x-api-key|api-key)$/i.test(key) && value ? "********" : value,
    ])
  )
}

