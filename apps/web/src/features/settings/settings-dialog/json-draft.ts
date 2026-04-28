import type { Dispatch, SetStateAction } from "react"
import type { LLMSettings, ModelProvider, ModelRole } from "@simula/shared"
import { providers, roles } from "./constants"
import type { ProviderJsonDraft, ProviderJsonField, RoleJsonDraft, RoleJsonField } from "./types"

export function emptyRoleJsonDraft(): RoleJsonDraft {
  return Object.fromEntries(
    roles.map((role) => [role, { extraBody: "", safetySettings: "" }])
  ) as RoleJsonDraft
}

export function emptyProviderJsonDraft(): ProviderJsonDraft {
  return Object.fromEntries(
    providers.map((provider) => [provider.value, { extraHeaders: "" }])
  ) as ProviderJsonDraft
}

export function buildRoleJsonDraft(settings: LLMSettings): RoleJsonDraft {
  return Object.fromEntries(
    roles.map((role) => [
      role,
      {
        extraBody: formatJson(settings.roles[role].extraBody),
        safetySettings: formatJson(settings.roles[role].safetySettings),
      },
    ])
  ) as RoleJsonDraft
}

export function buildProviderJsonDraft(settings: LLMSettings): ProviderJsonDraft {
  return Object.fromEntries(
    providers.map((provider) => [
      provider.value,
      {
        extraHeaders: formatJson(settings.providers[provider.value].extraHeaders),
      },
    ])
  ) as ProviderJsonDraft
}

export function updateRoleJsonDraft(
  role: ModelRole,
  field: RoleJsonField,
  value: string,
  setJsonDraft: Dispatch<SetStateAction<RoleJsonDraft>>
): void {
  setJsonDraft((current) => ({
    ...current,
    [role]: {
      ...current[role],
      [field]: value,
    },
  }))
}

export function updateProviderJsonDraft(
  provider: ModelProvider,
  field: ProviderJsonField,
  value: string,
  setJsonDraft: Dispatch<SetStateAction<ProviderJsonDraft>>
): void {
  setJsonDraft((current) => ({
    ...current,
    [provider]: {
      ...current[provider],
      [field]: value,
    },
  }))
}

export function applyJsonDrafts(
  draft: LLMSettings,
  roleJsonDraft: RoleJsonDraft,
  providerJsonDraft: ProviderJsonDraft
): LLMSettings {
  const next = structuredClone(draft)
  for (const provider of providers.map((item) => item.value)) {
    next.providers[provider].extraHeaders = parseHeadersJson(providerJsonDraft[provider].extraHeaders, `${provider} extra headers`)
  }
  for (const role of roles) {
    next.roles[role].extraBody = parseObjectJson(roleJsonDraft[role].extraBody, `${role} extra body`)
    next.roles[role].safetySettings = parseArrayJson(roleJsonDraft[role].safetySettings, `${role} safety settings`)
  }
  return next
}

function formatJson(value: unknown): string {
  return value === undefined ? "" : JSON.stringify(value, null, 2)
}

function parseObjectJson(value: string, label: string): Record<string, unknown> | undefined {
  const parsed = parseJson(value, label)
  if (parsed === undefined) {
    return undefined
  }
  if (!isPlainObject(parsed)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return parsed
}

function parseHeadersJson(value: string, label: string): Record<string, string> | undefined {
  const parsed = parseObjectJson(value, label)
  if (!parsed) {
    return undefined
  }
  return Object.fromEntries(Object.entries(parsed).map(([key, headerValue]) => [key, String(headerValue)]))
}

function parseArrayJson(value: string, label: string): Array<Record<string, string>> | undefined {
  const parsed = parseJson(value, label)
  if (parsed === undefined) {
    return undefined
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array.`)
  }
  return parsed.map((entry) => {
    if (!isPlainObject(entry)) {
      throw new Error(`${label} entries must be JSON objects.`)
    }
    return Object.fromEntries(Object.entries(entry).map(([key, settingValue]) => [key, String(settingValue)]))
  })
}

function parseJson(value: string, label: string): unknown {
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    throw new Error(`${label} is not valid JSON.`)
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

