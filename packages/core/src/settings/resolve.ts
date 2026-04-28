import type { LLMSettings, ModelRole, ResolvedRoleSettings } from "@simula/shared"
import { normalizeSettings } from "./normalize"

export function resolveRoleSettings(settings: LLMSettings, role: ModelRole): ResolvedRoleSettings {
  const normalized = normalizeSettings(settings)
  const roleSettings = normalized.roles[role]
  const providerSettings = normalized.providers[roleSettings.provider]
  return {
    ...providerSettings,
    ...roleSettings,
  }
}

