import { isOpenAICompatibleProvider } from "@/backend/core/settings/validate"
import type {
  ModelProvider,
  ProviderSettings,
  SettingsModelsResponse,
} from "@/shared"

export async function discoverProviderModels(
  provider: ModelProvider,
  connection: ProviderSettings
): Promise<SettingsModelsResponse> {
  if (isOpenAICompatibleProvider(provider) && !connection.baseUrl?.trim()) {
    throw new Error("Base URL is required to load models.")
  }

  if (provider === "gemini") {
    return { models: await listGeminiModels(connection) }
  }

  const response = await fetch(modelsUrl(provider, connection.baseUrl), {
    headers: modelRequestHeaders(provider, connection),
  })
  const body = await readModelsResponseBody(response) as { data?: Array<{ id?: unknown }> }
  const models = (body.data ?? [])
    .map((model) => model.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)

  return { models: sortModels(provider, filterModels(provider, models)) }
}

async function listGeminiModels(connection: ProviderSettings): Promise<string[]> {
  const apiKey = connection.apiKey?.trim()
  if (!apiKey) {
    throw new Error("API key is required to load models.")
  }

  const models: string[] = []
  let pageToken: string | undefined
  do {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/models")
    url.searchParams.set("key", apiKey)
    url.searchParams.set("pageSize", "1000")
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken)
    }
    const response = await fetch(url)
    const body = await readModelsResponseBody(response) as {
      models?: Array<{
        name?: unknown
        baseModelId?: unknown
        supportedGenerationMethods?: unknown
        supportedActions?: unknown
      }>
      nextPageToken?: unknown
    }
    models.push(
      ...(body.models ?? [])
        .filter(supportsGeminiTextGeneration)
        .map((model) => model.baseModelId ?? model.name)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
        .map((id) => id.replace(/^models\//, ""))
    )
    pageToken = typeof body.nextPageToken === "string" && body.nextPageToken ? body.nextPageToken : undefined
  } while (pageToken)

  return sortModels("gemini", [...new Set(models)])
}

async function readModelsResponseBody(response: Response): Promise<Record<string, unknown>> {
  const body = await response.json().catch(() => undefined)
  if (!response.ok) {
    throw new Error(`Failed to load models: ${response.status} ${response.statusText}`)
  }
  return typeof body === "object" && body !== null ? body as Record<string, unknown> : {}
}

function modelsUrl(provider: ModelProvider, baseUrl: string | undefined): string {
  if (provider === "openai") {
    return "https://api.openai.com/v1/models"
  }
  if (provider === "anthropic") {
    return "https://api.anthropic.com/v1/models"
  }
  if (!baseUrl) {
    throw new Error("Base URL is required to load models.")
  }
  return `${baseUrl.replace(/\/+$/, "")}/models`
}

function modelRequestHeaders(provider: ModelProvider, connection: ProviderSettings): Record<string, string> {
  if (provider === "anthropic") {
    return {
      "anthropic-version": "2023-06-01",
      ...(connection.apiKey?.trim() ? { "x-api-key": connection.apiKey } : {}),
      ...(connection.extraHeaders ?? {}),
    }
  }
  return {
    ...(connection.apiKey?.trim() ? { Authorization: `Bearer ${connection.apiKey}` } : {}),
    ...(connection.extraHeaders ?? {}),
  }
}

function supportsGeminiTextGeneration(model: {
  supportedGenerationMethods?: unknown
  supportedActions?: unknown
}): boolean {
  const methods = Array.isArray(model.supportedGenerationMethods)
    ? model.supportedGenerationMethods
    : Array.isArray(model.supportedActions)
      ? model.supportedActions
      : []
  return methods.length === 0 || methods.includes("generateContent")
}

function filterModels(provider: ModelProvider, models: string[]): string[] {
  if (provider !== "openai") {
    return models.filter((model) => !model.toLowerCase().includes("codex"))
  }
  return models.filter((model) =>
    /^gpt-\d+(?:\.\d+)*(?:-[a-z]+)?$/i.test(model) &&
    !model.toLowerCase().includes("codex") &&
    readModelDate(model) === undefined
  )
}

function sortModels(provider: ModelProvider, models: string[]): string[] {
  return [...new Set(models)].sort((left, right) => compareModelIds(provider, left, right))
}

function compareModelIds(provider: ModelProvider, left: string, right: string): number {
  if (provider === "openai") {
    return compareNumberLists(readGptVersion(right), readGptVersion(left)) || left.localeCompare(right)
  }
  return compareDates(right, left) || compareNumberLists(readModelNumbers(right), readModelNumbers(left)) || left.localeCompare(right)
}

function readGptVersion(model: string): number[] {
  const match = /^gpt-(\d+(?:\.\d+)*)/i.exec(model)
  return match ? match[1].split(".").map(Number) : []
}

function readModelNumbers(model: string): number[] {
  return [...model.matchAll(/\d+(?:\.\d+)?/g)].flatMap((match) => match[0].split(".").map(Number))
}

function compareDates(left: string, right: string): number {
  return (readModelDate(left) ?? 0) - (readModelDate(right) ?? 0)
}

function readModelDate(model: string): number | undefined {
  const match = /\b(20\d{6})\b/.exec(model)
  return match ? Number(match[1]) : undefined
}

function compareNumberLists(left: number[], right: number[]): number {
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] ?? -1) - (right[index] ?? -1)
    if (diff !== 0) {
      return diff
    }
  }
  return 0
}
