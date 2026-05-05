import type { LLMSettings, LLMSettingsInput, ModelProvider, ProviderSettings, RoleSettings } from "@simula/shared"
import { MODEL_PROVIDERS, MODEL_ROLES } from "./constants"
import { PROVIDER_DEFAULTS, ROLE_DEFAULTS, ROLE_PROVIDER_DEFAULTS, defaultSettings } from "./defaults"

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

export function applyRoleProviderDefaults(config: RoleSettings): RoleSettings {
  const { contextTokenBudget: _removed, ...roleConfig } = config as RoleSettings & { contextTokenBudget?: unknown }
  const providerDefaults = ROLE_PROVIDER_DEFAULTS[config.provider] ?? {}
  return {
    ...roleConfig,
    ...Object.fromEntries(
      Object.entries(providerDefaults).filter(([key]) => roleConfig[key as keyof RoleSettings] === undefined)
    ),
  }
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

function isStructuredSettings(settings: LLMSettingsInput): settings is Partial<LLMSettings> {
  return typeof settings === "object" && settings !== null && ("providers" in settings || "roles" in settings)
}
