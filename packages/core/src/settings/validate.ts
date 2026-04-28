import type { LLMSettings, ModelProvider, ModelRole } from "@simula/shared"
import { MODEL_PROVIDERS, MODEL_ROLES, OPENAI_COMPATIBLE_PROVIDERS } from "./constants"
import { resolveRoleSettings } from "./resolve"

export function validateSettings(settings: LLMSettings): void {
  for (const role of MODEL_ROLES) {
    validateRoleSettings(settings, role)
  }
}

export function validateRoleSettings(settings: LLMSettings, role: ModelRole): void {
  const config = resolveRoleSettings(settings, role)
  if (!MODEL_PROVIDERS.includes(config.provider)) {
    throw new Error(`Unsupported provider for ${role}: ${String(config.provider)}`)
  }
  if (!config.model.trim()) {
    throw new Error(`Model is required for ${role}.`)
  }
  if (!OPENAI_COMPATIBLE_PROVIDERS.includes(config.provider) && !config.apiKey?.trim()) {
    throw new Error(`API key is required for ${role}.`)
  }
  if (OPENAI_COMPATIBLE_PROVIDERS.includes(config.provider) && !config.baseUrl?.trim()) {
    throw new Error(`Base URL is required for ${role}.`)
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
  if (config.topP !== undefined && (!Number.isFinite(config.topP) || config.topP < 0 || config.topP > 1)) {
    throw new Error(`topP for ${role} must be between 0 and 1.`)
  }
  if (config.topK !== undefined && (!Number.isInteger(config.topK) || config.topK < 1)) {
    throw new Error(`topK for ${role} must be a positive integer.`)
  }
  if (config.frequencyPenalty !== undefined && !Number.isFinite(config.frequencyPenalty)) {
    throw new Error(`frequencyPenalty for ${role} must be a finite number.`)
  }
  if (config.presencePenalty !== undefined && !Number.isFinite(config.presencePenalty)) {
    throw new Error(`presencePenalty for ${role} must be a finite number.`)
  }
  if (config.seed !== undefined && (!Number.isInteger(config.seed) || config.seed < 0)) {
    throw new Error(`seed for ${role} must be a non-negative integer.`)
  }
  if (
    config.contextTokenBudget !== undefined &&
    (!Number.isInteger(config.contextTokenBudget) || config.contextTokenBudget < 1)
  ) {
    throw new Error(`contextTokenBudget for ${role} must be a positive integer.`)
  }
}

export function isOpenAICompatibleProvider(provider: ModelProvider): boolean {
  return OPENAI_COMPATIBLE_PROVIDERS.includes(provider)
}

