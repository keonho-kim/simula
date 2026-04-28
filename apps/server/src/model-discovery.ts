import { isOpenAICompatibleProvider } from "@simula/core"
import type {
  LLMSettings,
  ModelProvider,
  ProviderSettings,
  SettingsModelsRequest,
  SettingsModelsResponse,
} from "@simula/shared"
import { mergeRetainedHeaders, readSettings } from "./settings-store"

export async function listProviderModels(payload: SettingsModelsRequest): Promise<SettingsModelsResponse> {
  const provider = payload.provider
  if (!isOpenAICompatibleProvider(provider)) {
    throw new Error(`${provider} does not support model discovery.`)
  }
  const connection = mergeModelRequestConnection(provider, payload.connection, await readSettings())
  if (!connection.baseUrl?.trim()) {
    throw new Error("Base URL is required to load models.")
  }

  const response = await fetch(modelsUrl(connection.baseUrl), {
    headers: modelRequestHeaders(connection),
  })
  if (!response.ok) {
    throw new Error(`Failed to load models: ${response.status} ${response.statusText}`)
  }
  const body = await response.json() as { data?: Array<{ id?: unknown }> }
  const models = (body.data ?? [])
    .map((model) => model.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
  return { models }
}

function mergeModelRequestConnection(
  provider: ModelProvider,
  connection: ProviderSettings,
  settings: LLMSettings
): ProviderSettings {
  const previous = settings.providers[provider]
  return {
    ...connection,
    apiKey: connection.apiKey === "********" ? previous.apiKey : connection.apiKey,
    extraHeaders: mergeRetainedHeaders(connection.extraHeaders, previous.extraHeaders),
  }
}

function modelsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/models`
}

function modelRequestHeaders(connection: ProviderSettings): Record<string, string> {
  return {
    ...(connection.apiKey?.trim() ? { Authorization: `Bearer ${connection.apiKey}` } : {}),
    ...(connection.extraHeaders ?? {}),
  }
}

