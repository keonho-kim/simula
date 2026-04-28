import { ChatAnthropic } from "@langchain/anthropic"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { ChatOpenAI } from "@langchain/openai"
import type {
  ActorCardStep,
  ActorTraceStep,
  CoordinatorTraceStep,
  GeneratorRosterStep,
  LLMSettings,
  ModelMetrics,
  ModelProvider,
  ModelRole,
  PlannerTraceStep,
  RoleSettings,
} from "@simula/shared"
import { isOpenAICompatibleProvider } from "../settings"

export interface RoleTextResult {
  text: string
  metrics: ModelMetrics
}

export async function invokeRoleText(
  settings: LLMSettings,
  role: ModelRole,
  prompt: string
): Promise<string> {
  return (await invokeRoleTextWithMetrics(settings, role, "draft", 1, prompt)).text
}

export async function invokeRoleTextWithMetrics(
  settings: LLMSettings,
  role: ModelRole,
  step: ActorTraceStep | PlannerTraceStep | CoordinatorTraceStep | GeneratorRosterStep | ActorCardStep | "draft",
  attempt: number,
  prompt: string
): Promise<RoleTextResult> {
  const config = settings[role]
  const startedAt = performance.now()

  const model = createChatModel(config)

  let text = ""
  let firstChunkAt: number | undefined
  let usage: TokenUsage | undefined

  for await (const chunk of await model.stream(prompt)) {
    firstChunkAt ??= performance.now()
    text += contentToText(chunk.content)
    usage = readUsage(chunk.usage_metadata) ?? usage
  }

  const completedAt = performance.now()
  const tokenUsage = usage ?? zeroUsage()
  return {
    text: text.trim(),
    metrics: {
      role,
      step,
      attempt,
      ttftMs: Math.max(0, Math.round(firstChunkAt ? firstChunkAt - startedAt : completedAt - startedAt)),
      durationMs: Math.max(0, Math.round(completedAt - startedAt)),
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      totalTokens: tokenUsage.totalTokens,
      tokenSource: usage ? "provider" : "unavailable",
    },
  }
}

type StreamingChatModel = {
  stream(prompt: string): Promise<AsyncIterable<{ content: unknown; usage_metadata?: unknown }>>
}

export function createChatModel(config: RoleSettings): StreamingChatModel {
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

function buildOpenAIModelKwargs(config: RoleSettings): Record<string, unknown> {
  const kwargs: Record<string, unknown> = { ...(config.extraBody ?? {}) }
  if (config.seed !== undefined) {
    kwargs.seed = config.seed
  }
  if (config.reasoningEffort) {
    kwargs.reasoning_effort = config.reasoningEffort
  }
  return kwargs
}

interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

function readUsage(value: unknown): TokenUsage | undefined {
  if (!value || typeof value !== "object") {
    return undefined
  }
  const usage = value as {
    input_tokens?: unknown
    output_tokens?: unknown
    total_tokens?: unknown
  }
  const inputTokens = numberOrZero(usage.input_tokens)
  const outputTokens = numberOrZero(usage.output_tokens)
  const explicitTotal = numberOrZero(usage.total_tokens)
  const totalTokens = explicitTotal || inputTokens + outputTokens
  if (!inputTokens && !outputTokens && !totalTokens) {
    return undefined
  }
  return { inputTokens, outputTokens, totalTokens }
}

function zeroUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function contentToText(content: unknown): string {
  if (typeof content === "string") {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part
        }
        if (typeof part === "object" && part && "text" in part) {
          return String(part.text)
        }
        return ""
      })
      .join("")
  }
  return ""
}
