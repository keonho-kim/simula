import type { LLMSettings, ModelProvider, ProviderSettings, SettingsModelsRequest, SettingsModelsResponse } from "@/shared"
import { discoverProviderModels } from "@/backend/integrations/llm/model-discovery"
import { mergeRetainedHeaders, readSettings } from "@/backend/storage/settings-store"

export async function listProviderModels(payload: SettingsModelsRequest): Promise<SettingsModelsResponse> {
  const provider = payload.provider
  const connection = mergeModelRequestConnection(provider, payload.connection, await readSettings())
  return discoverProviderModels(provider, connection)
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
