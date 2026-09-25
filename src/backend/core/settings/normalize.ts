/**
 * Purpose: Normalize current and legacy settings while enforcing model concurrency bounds.
 * Pattern: Boundary normalization.
 * Usage: Called when settings are read, saved, sanitized, or resolved.
 * Related: src/backend/core/settings/defaults.ts, src/shared/settings.ts
 */
import type { LLMSettings, LLMSettingsInput, ModelProvider, ProviderSettings, RoleSettings } from "@/shared"
import { MAX_MODEL_CONCURRENCY } from "@/shared/settings"
import { MODEL_PROVIDERS, MODEL_ROLES } from "@/backend/core/settings/constants"
import { PROVIDER_DEFAULTS, ROLE_DEFAULTS, ROLE_PROVIDER_DEFAULTS, defaultSettings } from "@/backend/core/settings/defaults"

export function normalizeSettings(settings: LLMSettingsInput): LLMSettings {
  const defaults = defaultSettings()
  const next = isStructuredSettings(settings)
    ? normalizeStructuredSettings(settings, defaults)
    : normalizeLegacySettings(settings, defaults)

  const concurrency = next.concurrency ?? defaults.concurrency
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > MAX_MODEL_CONCURRENCY) {
    throw new Error(`Model concurrency must be an integer between 1 and ${MAX_MODEL_CONCURRENCY}.`)
  }
  return {
    concurrency,
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
  const roleConfig = { ...(config as RoleSettings & { contextTokenBudget?: unknown }) }
  delete roleConfig.contextTokenBudget
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
    concurrency: settings.concurrency ?? defaults.concurrency,
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

  return { concurrency: defaults.concurrency, providers, roles }
}

function nonEmptyProviderSettings(settings: ProviderSettings): ProviderSettings {
  return Object.fromEntries(
    Object.entries(settings).filter(([, value]) => value !== undefined && value !== "")
  ) as ProviderSettings
}

function isStructuredSettings(settings: LLMSettingsInput): settings is Partial<LLMSettings> {
  return typeof settings === "object" && settings !== null && ("providers" in settings || "roles" in settings || "concurrency" in settings)
}
