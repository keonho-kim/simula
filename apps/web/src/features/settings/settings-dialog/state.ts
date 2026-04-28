import type { Dispatch, SetStateAction } from "react"
import type { LLMSettings, ModelProvider, ModelRole, ProviderSettings, RoleSettings } from "@simula/shared"
import { roleProviderDefaults } from "./constants"

export function updateRole(
  role: ModelRole,
  value: RoleSettings,
  setDraft: Dispatch<SetStateAction<LLMSettings | undefined>>
): void {
  setDraft((current) => current && { ...current, roles: { ...current.roles, [role]: value } })
}

export function patchRole(
  role: ModelRole,
  patch: Partial<RoleSettings>,
  setDraft: Dispatch<SetStateAction<LLMSettings | undefined>>
): void {
  setDraft((current) => current && {
    ...current,
    roles: { ...current.roles, [role]: { ...current.roles[role], ...patch } },
  })
}

export function patchProvider(
  provider: ModelProvider,
  patch: Partial<ProviderSettings>,
  setDraft: Dispatch<SetStateAction<LLMSettings | undefined>>
): void {
  setDraft((current) => current && {
    ...current,
    providers: { ...current.providers, [provider]: { ...current.providers[provider], ...patch } },
  })
}

export function applyProviderDefaults(config: RoleSettings, provider: ModelProvider): RoleSettings {
  return {
    ...config,
    ...roleProviderDefaults[provider],
    provider,
  }
}

