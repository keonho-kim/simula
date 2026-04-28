import type { ModelProvider, ModelRole } from "@simula/shared"

export type SettingsPage = "providers" | "roles"
export type RoleJsonField = "extraBody" | "safetySettings"
export type ProviderJsonField = "extraHeaders"
export type RoleJsonDraft = Record<ModelRole, Record<RoleJsonField, string>>
export type ProviderJsonDraft = Record<ModelProvider, Record<ProviderJsonField, string>>

