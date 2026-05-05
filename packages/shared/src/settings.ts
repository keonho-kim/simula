import type { ModelProvider, ModelRole } from "./model"

export interface RoleSettings {
  provider: ModelProvider
  model: string
  temperature: number
  maxTokens: number
  timeoutSeconds: number
  topP?: number
  topK?: number
  frequencyPenalty?: number
  presencePenalty?: number
  seed?: number
  reasoningEffort?: "low" | "medium" | "high"
  extraBody?: Record<string, unknown>
  safetySettings?: Array<Record<string, string>>
}

export interface ProviderSettings {
  baseUrl?: string
  apiKey?: string
  streamUsage?: boolean
  extraHeaders?: Record<string, string>
}

export type ProviderSettingsMap = Record<ModelProvider, ProviderSettings>
export type RoleSettingsMap = Record<ModelRole, RoleSettings>

export interface LLMSettings {
  providers: ProviderSettingsMap
  roles: RoleSettingsMap
}

export type LegacyLLMSettings = Partial<Record<ModelRole, RoleSettings & ProviderSettings>>
export type LLMSettingsInput = Partial<LLMSettings> | LegacyLLMSettings

export type ResolvedRoleSettings = RoleSettings & ProviderSettings
