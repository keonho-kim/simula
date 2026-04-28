import type {
  LLMSettings,
  LLMSettingsInput,
  ModelProvider,
  ModelRole,
  ProviderSettings,
  ResolvedRoleSettings,
  RoleSettings,
} from "@simula/shared"

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

const PROVIDER_DEFAULTS: Record<ModelProvider, ProviderSettings> = {
  openai: { streamUsage: true },
  anthropic: { streamUsage: true },
  gemini: { streamUsage: true },
  ollama: { baseUrl: "http://localhost:11434/v1", apiKey: "ollama", streamUsage: true },
  lmstudio: { baseUrl: "http://localhost:1234/v1", apiKey: "lm-studio", streamUsage: true },
  vllm: { baseUrl: "http://localhost:8000/v1", apiKey: "vllm", streamUsage: true },
  litellm: { baseUrl: "http://localhost:4000/v1", streamUsage: true },
}

const ROLE_DEFAULTS: Record<ModelRole, RoleSettings> = Object.fromEntries(
  MODEL_ROLES.map((role) => [
    role,
    {
      provider: "openai",
      model: "gpt-5.4-mini",
      temperature: role === "storyBuilder" ? 0.7 : role === "coordinator" || role === "actor" ? 0.4 : 0.2,
      maxTokens: role === "storyBuilder" ? 5000 : role === "repair" ? 2400 : 4096,
      timeoutSeconds: 60,
      contextTokenBudget: role === "actor" ? DEFAULT_ACTOR_CONTEXT_TOKEN_BUDGET : undefined,
    } satisfies RoleSettings,
  ])
) as Record<ModelRole, RoleSettings>

const ROLE_PROVIDER_DEFAULTS: Partial<Record<ModelProvider, Partial<RoleSettings>>> = {
  gemini: { model: "gemini-2.5-pro" },
  ollama: { model: "llama3.1" },
  lmstudio: { model: "local-model", reasoningEffort: "medium" },
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

export function normalizeSettings(settings: LLMSettingsInput): LLMSettings {
  const defaults = defaultSettings()
  const next = isStructuredSettings(settings)
    ? normalizeStructuredSettings(settings, defaults)
    : normalizeLegacySettings(settings, defaults)

  return {
    providers: Object.fromEntries(
      MODEL_PROVIDERS.map((provider) => [
        provider,
        {
          ...PROVIDER_DEFAULTS[provider],
          ...next.providers[provider],
        },
      ])
    ) as LLMSettings["providers"],
    roles: Object.fromEntries(
      MODEL_ROLES.map((role) => [
        role,
        applyRoleProviderDefaults({
          ...ROLE_DEFAULTS[role],
          ...next.roles[role],
        }),
      ])
    ) as LLMSettings["roles"],
  }
}

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

export function validateSettings(settings: LLMSettings): void {
  for (const role of MODEL_ROLES) {
    validateRoleSettings(settings, role)
  }
}

export function validateRoleSettings(settings: LLMSettings, role: ModelRole): void {
  const config = resolveRoleSettings(settings, role)
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

export function resolveRoleSettings(settings: LLMSettings, role: ModelRole): ResolvedRoleSettings {
  const normalized = normalizeSettings(settings)
  const roleSettings = normalized.roles[role]
  const providerSettings = normalized.providers[roleSettings.provider]
  return {
    ...providerSettings,
    ...roleSettings,
  }
}

export function isOpenAICompatibleProvider(provider: ModelProvider): boolean {
  return OPENAI_COMPATIBLE_PROVIDERS.includes(provider)
}

export function defaultsForProvider(provider: ModelProvider): ProviderSettings {
  return PROVIDER_DEFAULTS[provider] ?? {}
}

function normalizeStructuredSettings(settings: Partial<LLMSettings>, defaults: LLMSettings): LLMSettings {
  return {
    providers: {
      ...defaults.providers,
      ...settings.providers,
    },
    roles: {
      ...defaults.roles,
      ...settings.roles,
    },
  }
}

function normalizeLegacySettings(settings: LLMSettingsInput, defaults: LLMSettings): LLMSettings {
  const legacy = settings as Record<string, RoleSettings & ProviderSettings | undefined>
  const roles = { ...defaults.roles }
  const providers = { ...defaults.providers }
  const promotedProviders: Partial<Record<ModelProvider, ProviderSettings>> = {}

  for (const role of MODEL_ROLES) {
    const configured = role === "actor" ? legacy.actor ?? legacy.coordinator : legacy[role]
    if (!configured) {
      continue
    }
    const { apiKey, baseUrl, streamUsage, extraHeaders, ...roleSettings } = configured
    roles[role] = applyRoleProviderDefaults({ ...roles[role], ...roleSettings })
    const provider = roles[role].provider
    const promoted = promotedProviders[provider] ?? {}
    const incoming = nonEmptyProviderSettings({ apiKey, baseUrl, streamUsage, extraHeaders })
    promotedProviders[provider] = {
      ...promoted,
      ...Object.fromEntries(
        Object.entries(incoming).filter(([key]) => promoted[key as keyof ProviderSettings] === undefined)
      ),
    }
  }

  for (const provider of MODEL_PROVIDERS) {
    if (promotedProviders[provider]) {
      providers[provider] = {
        ...providers[provider],
        ...promotedProviders[provider],
      }
    }
  }

  return { providers, roles }
}

function nonEmptyProviderSettings(settings: ProviderSettings): ProviderSettings {
  return Object.fromEntries(
    Object.entries(settings).filter(([, value]) => value !== undefined && value !== "")
  ) as ProviderSettings
}

function applyRoleProviderDefaults(config: RoleSettings): RoleSettings {
  const providerDefaults = ROLE_PROVIDER_DEFAULTS[config.provider] ?? {}
  return {
    ...config,
    ...Object.fromEntries(
      Object.entries(providerDefaults).filter(([key]) => config[key as keyof RoleSettings] === undefined)
    ),
  }
}

function isStructuredSettings(settings: LLMSettingsInput): settings is Partial<LLMSettings> {
  return typeof settings === "object" && settings !== null && ("providers" in settings || "roles" in settings)
}

function maskHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      /^(authorization|x-api-key|api-key)$/i.test(key) && value ? "********" : value,
    ])
  )
}
