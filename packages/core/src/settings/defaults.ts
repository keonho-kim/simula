import type { LLMSettings, ModelProvider, ModelRole, ProviderSettings, RoleSettings } from "@simula/shared"
import { MODEL_PROVIDERS, MODEL_ROLES } from "./constants"

export const PROVIDER_DEFAULTS: Record<ModelProvider, ProviderSettings> = {
  openai: { streamUsage: true },
  anthropic: { streamUsage: true },
  gemini: { streamUsage: true },
  ollama: { baseUrl: "http://localhost:11434/v1", apiKey: "ollama", streamUsage: true },
  lmstudio: { baseUrl: "http://localhost:1234/v1", apiKey: "lm-studio", streamUsage: true },
  vllm: { baseUrl: "http://localhost:8000/v1", apiKey: "vllm", streamUsage: true },
  litellm: { baseUrl: "http://localhost:4000/v1", streamUsage: true },
}

export const ROLE_DEFAULTS: Record<ModelRole, RoleSettings> = Object.fromEntries(
  MODEL_ROLES.map((role) => [
    role,
    {
      provider: "openai",
      model: "gpt-5.4-mini",
      temperature: role === "storyBuilder" ? 0.7 : role === "coordinator" || role === "actor" ? 0.4 : 0.2,
      maxTokens: role === "storyBuilder" ? 5000 : role === "repair" ? 2400 : 4096,
      timeoutSeconds: 60,
    } satisfies RoleSettings,
  ])
) as Record<ModelRole, RoleSettings>

export const ROLE_PROVIDER_DEFAULTS: Partial<Record<ModelProvider, Partial<RoleSettings>>> = {
  gemini: { model: "gemini-2.5-pro" },
  ollama: { model: "llama3.1" },
  lmstudio: { model: "local-model" },
  vllm: { model: "local-model" },
  litellm: { model: "openai/gpt-5.4-mini" },
}

export function defaultSettings(): LLMSettings {
  return {
    providers: Object.fromEntries(
      MODEL_PROVIDERS.map((provider) => [provider, { ...PROVIDER_DEFAULTS[provider] }])
    ) as LLMSettings["providers"],
    roles: Object.fromEntries(
      MODEL_ROLES.map((role) => [role, { ...ROLE_DEFAULTS[role] }])
    ) as LLMSettings["roles"],
  }
}

export function defaultsForProvider(provider: ModelProvider): ProviderSettings {
  return PROVIDER_DEFAULTS[provider] ?? {}
}
