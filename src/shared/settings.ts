/**
 * Purpose: Define shared provider, role, and model concurrency settings contracts.
 * Pattern: Shared contract.
 * Usage: Imported by settings storage, API, runtime admission, and browser forms.
 * Related: src/backend/core/settings/normalize.ts, src/backend/runtime/model-admission.ts
 */
import type { ModelProvider, ModelRole } from "@/shared/model"

export const DEFAULT_MODEL_CONCURRENCY = 8
export const MAX_MODEL_CONCURRENCY = 50

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
  concurrency: number
  providers: ProviderSettingsMap
  roles: RoleSettingsMap
}

export type LegacyLLMSettings = Partial<Record<ModelRole, RoleSettings & ProviderSettings>>
export type LLMSettingsInput = Partial<LLMSettings> | LegacyLLMSettings

export type ResolvedRoleSettings = RoleSettings & ProviderSettings
