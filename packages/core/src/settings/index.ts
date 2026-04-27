import type { LLMSettings, ModelRole, RoleSettings } from "@simula/shared"

export const MODEL_ROLES: ModelRole[] = [
  "storyBuilder",
  "planner",
  "generator",
  "coordinator",
  "observer",
  "repair",
]

export function defaultSettings(): LLMSettings {
  return Object.fromEntries(
    MODEL_ROLES.map((role) => [
      role,
      {
        provider: "openai",
        model: role === "repair" ? "gpt-5.4-mini" : "gpt-5.4-mini",
        apiKey: "",
        temperature: role === "storyBuilder" ? 0.7 : role === "coordinator" ? 0.4 : 0.2,
        maxTokens: role === "storyBuilder" ? 5000 : role === "repair" ? 2400 : 4096,
        timeoutSeconds: 60,
      } satisfies RoleSettings,
    ])
  ) as LLMSettings
}

export function normalizeSettings(settings: Partial<LLMSettings>): LLMSettings {
  const defaults = defaultSettings()
  const migrated = settings as Partial<LLMSettings> & { actor?: RoleSettings }
  return Object.fromEntries(
    MODEL_ROLES.map((role) => [
      role,
      {
        ...defaults[role],
        ...(role === "generator" ? (migrated.generator ?? migrated.actor) : settings[role] ?? {}),
      },
    ])
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
  if (config.provider !== "openai" && config.provider !== "anthropic") {
    throw new Error(`Unsupported provider for ${role}: ${String(config.provider)}`)
  }
  if (!config.model.trim()) {
    throw new Error(`Model is required for ${role}.`)
  }
  if (!config.apiKey?.trim()) {
    throw new Error(`API key is required for ${role}.`)
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
}
