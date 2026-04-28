import { ChatAnthropic } from "@langchain/anthropic"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { ChatOpenAI } from "@langchain/openai"
import type { ModelProvider, ResolvedRoleSettings } from "@simula/shared"
import { isOpenAICompatibleProvider } from "../settings"
import type { StreamingChatModel } from "./types"

export function createChatModel(config: ResolvedRoleSettings): StreamingChatModel {
  if (config.provider === "anthropic") {
    return new ChatAnthropic({
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      streamUsage: config.streamUsage ?? true,
    })
  }
  if (config.provider === "gemini") {
    return new ChatGoogleGenerativeAI({
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens,
      topP: config.topP,
      topK: config.topK,
      safetySettings: config.safetySettings?.map((setting) => ({
        category: setting.category,
        threshold: setting.threshold,
      })) as never,
      streamUsage: config.streamUsage ?? true,
    })
  }
  return new ChatOpenAI({
    apiKey: apiKeyForOpenAICompatibleProvider(config.provider, config.apiKey),
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    timeout: config.timeoutSeconds * 1000,
    streamUsage: config.streamUsage ?? true,
    topP: config.topP,
    frequencyPenalty: config.frequencyPenalty,
    presencePenalty: config.presencePenalty,
    modelKwargs: buildOpenAIModelKwargs(config),
    configuration: {
      baseURL: isOpenAICompatibleProvider(config.provider) ? config.baseUrl : undefined,
      defaultHeaders: config.extraHeaders,
    },
  })
}

function apiKeyForOpenAICompatibleProvider(provider: ModelProvider, apiKey: string | undefined): string | undefined {
  if (!isOpenAICompatibleProvider(provider)) {
    return apiKey
  }
  return apiKey?.trim() || provider
}

function buildOpenAIModelKwargs(config: ResolvedRoleSettings): Record<string, unknown> {
  const kwargs: Record<string, unknown> = { ...(config.extraBody ?? {}) }
  if (config.seed !== undefined) {
    kwargs.seed = config.seed
  }
  if (config.reasoningEffort) {
    kwargs.reasoning_effort = config.reasoningEffort
  }
  return kwargs
}

