/**
 * Purpose: Update provider connections and explicit role selections in a settings draft.
 * Pattern: Immutable form transformations.
 * Usage: Called by settings form controls.
 * Related: src/ui/components/settings/role-settings-panel.tsx, src/ui/components/settings/model-field.tsx
 */
import type { Dispatch, SetStateAction } from "react"
import type { LLMSettings, ModelProvider, ModelRole, ProviderSettings, RoleSettings } from "@/shared"

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

export function selectRoleProvider(config: RoleSettings, provider: ModelProvider): RoleSettings {
  return {
    ...config,
    model: "",
    provider,
  }
}

