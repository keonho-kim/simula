import type { LLMSettings, ModelProvider, ModelRole, RoleSettings } from "@simula/shared"

export const MODEL_ROLES: ModelRole[] = [
  "storyBuilder",
  "planner",
  "generator",
  "coordinator",
  "actor",
  "observer",
  "repair",
]

export const MODEL_PROVIDERS: ModelProvider[] = [
  "openai",
  "anthropic",
  "gemini",
  "ollama",
  "lmstudio",
  "vllm",
  "litellm",
]

export const OPENAI_COMPATIBLE_PROVIDERS: ModelProvider[] = ["ollama", "lmstudio", "vllm", "litellm"]
export const DEFAULT_ACTOR_CONTEXT_TOKEN_BUDGET = 2000

const PROVIDER_DEFAULTS: Partial<Record<ModelProvider, Partial<RoleSettings>>> = {
  gemini: { model: "gemini-2.5-pro" },
  ollama: { model: "llama3.1", baseUrl: "http://localhost:11434/v1", apiKey: "ollama", streamUsage: false },
  lmstudio: {
    model: "local-model",
    baseUrl: "http://localhost:1234/v1",
    apiKey: "lm-studio",
    streamUsage: false,
    reasoningEffort: "medium",
  },
  vllm: { model: "local-model", baseUrl: "http://localhost:8000/v1", apiKey: "vllm", streamUsage: true },
  litellm: { model: "openai/gpt-5.4-mini", baseUrl: "http://localhost:4000/v1", streamUsage: false },
}

export function defaultSettings(): LLMSettings {
  return Object.fromEntries(
    MODEL_ROLES.map((role) => [
      role,
      {
        provider: "openai",
        model: role === "repair" ? "gpt-5.4-mini" : "gpt-5.4-mini",
        apiKey: "",
        temperature: role === "storyBuilder" ? 0.7 : role === "coordinator" || role === "actor" ? 0.4 : 0.2,
        maxTokens: role === "storyBuilder" ? 5000 : role === "repair" ? 2400 : 4096,
        timeoutSeconds: 60,
        streamUsage: true,
        contextTokenBudget: role === "actor" ? DEFAULT_ACTOR_CONTEXT_TOKEN_BUDGET : undefined,
      } satisfies RoleSettings,
    ])
  ) as LLMSettings
}

export function normalizeSettings(settings: Partial<LLMSettings>): LLMSettings {
  const defaults = defaultSettings()
  return Object.fromEntries(
    MODEL_ROLES.map((role) => {
      const configured = role === "actor" ? settings.actor ?? settings.coordinator : settings[role]
      const merged = {
        ...defaults[role],
        ...configured,
      }
      return [role, applyProviderDefaults(merged)]
    })
  ) as LLMSettings
}

export function sanitizeSettings(settings: LLMSettings): LLMSettings {
  const normalized = normalizeSettings(settings)
  return Object.fromEntries(
    MODEL_ROLES.map((role) => {
      const value = normalized[role]
      return [
        role,
        {
          ...value,
          apiKey: value.apiKey ? "********" : "",
          extraHeaders: value.extraHeaders ? maskHeaders(value.extraHeaders) : undefined,
        },
      ]
    })
  ) as LLMSettings
}

export function validateSettings(settings: LLMSettings): void {
  for (const role of MODEL_ROLES) {
    validateRoleSettings(settings, role)
  }
}

export function validateRoleSettings(settings: LLMSettings, role: ModelRole): void {
  const config = settings[role]
  if (!config) {
    throw new Error(`Missing model settings for ${role}.`)
  }
  if (!MODEL_PROVIDERS.includes(config.provider)) {
    throw new Error(`Unsupported provider for ${role}: ${String(config.provider)}`)
  }
  if (!config.model.trim()) {
    throw new Error(`Model is required for ${role}.`)
  }
  if (!OPENAI_COMPATIBLE_PROVIDERS.includes(config.provider) && !config.apiKey?.trim()) {
    throw new Error(`API key is required for ${role}.`)
  }
  if (OPENAI_COMPATIBLE_PROVIDERS.includes(config.provider) && !config.baseUrl?.trim()) {
    throw new Error(`Base URL is required for ${role}.`)
  }
  if (!Number.isFinite(config.temperature) || config.temperature < 0 || config.temperature > 2) {
    throw new Error(`Temperature for ${role} must be between 0 and 2.`)
  }
  if (!Number.isInteger(config.maxTokens) || config.maxTokens < 1) {
    throw new Error(`maxTokens for ${role} must be a positive integer.`)
  }
  if (!Number.isInteger(config.timeoutSeconds) || config.timeoutSeconds < 1) {
    throw new Error(`timeoutSeconds for ${role} must be a positive integer.`)
  }
  if (config.topP !== undefined && (!Number.isFinite(config.topP) || config.topP < 0 || config.topP > 1)) {
    throw new Error(`topP for ${role} must be between 0 and 1.`)
  }
  if (config.topK !== undefined && (!Number.isInteger(config.topK) || config.topK < 1)) {
    throw new Error(`topK for ${role} must be a positive integer.`)
  }
  if (config.frequencyPenalty !== undefined && !Number.isFinite(config.frequencyPenalty)) {
    throw new Error(`frequencyPenalty for ${role} must be a finite number.`)
  }
  if (config.presencePenalty !== undefined && !Number.isFinite(config.presencePenalty)) {
    throw new Error(`presencePenalty for ${role} must be a finite number.`)
  }
  if (config.seed !== undefined && (!Number.isInteger(config.seed) || config.seed < 0)) {
    throw new Error(`seed for ${role} must be a non-negative integer.`)
  }
  if (
    config.contextTokenBudget !== undefined &&
    (!Number.isInteger(config.contextTokenBudget) || config.contextTokenBudget < 1)
  ) {
    throw new Error(`contextTokenBudget for ${role} must be a positive integer.`)
  }
}

export function isOpenAICompatibleProvider(provider: ModelProvider): boolean {
  return OPENAI_COMPATIBLE_PROVIDERS.includes(provider)
}

export function defaultsForProvider(provider: ModelProvider): Partial<RoleSettings> {
  return PROVIDER_DEFAULTS[provider] ?? {}
}

function applyProviderDefaults(config: RoleSettings): RoleSettings {
  const providerDefaults = defaultsForProvider(config.provider)
  return {
    ...config,
    ...Object.fromEntries(
      Object.entries(providerDefaults).filter(([key]) => config[key as keyof RoleSettings] === undefined)
    ),
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
