import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { normalizeSettings } from "@simula/core"
import type { LLMSettings, LLMSettingsInput, ModelProvider } from "@simula/shared"
import { ENV_TOML_PATH, SETTINGS_PATH } from "./config"
import { isMissingFileError } from "./file-errors"

export async function readSettings(): Promise<LLMSettings> {
  return normalizeSettings({
    ...await readEnvTomlSettings(),
    ...await readSavedSettings(),
  })
}

export async function writeSettings(settings: LLMSettings): Promise<void> {
  const normalized = normalizeSettings(mergeRetainedSecrets(settings, await readSettings()))
  await mkdir(dirname(SETTINGS_PATH), { recursive: true }).catch(() => undefined)
  await writeFile(SETTINGS_PATH, `${JSON.stringify(normalized, null, 2)}\n`, "utf8")
}

export function mergeRetainedHeaders(
  next: Record<string, string> | undefined,
  previous: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!next) {
    return undefined
  }
  return Object.fromEntries(
    Object.entries(next).map(([key, value]) => [
      key,
      value === "********" ? previous?.[key] ?? "" : value,
    ])
  )
}

async function readEnvTomlSettings(): Promise<LLMSettingsInput> {
  try {
    const parsed = Bun.TOML.parse(await readFile(ENV_TOML_PATH, "utf8")) as {
      settings?: LLMSettingsInput
    }
    return parsed.settings ?? {}
  } catch (error) {
    if (isMissingFileError(error)) {
      return {}
    }
    throw new Error(`Failed to read env.toml: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    })
  }
}

async function readSavedSettings(): Promise<LLMSettingsInput> {
  try {
    return JSON.parse(await readFile(SETTINGS_PATH, "utf8")) as LLMSettingsInput
  } catch (error) {
    if (isMissingFileError(error)) {
      return {}
    }
    throw new Error(`Failed to read settings.json: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    })
  }
}

function mergeRetainedSecrets(next: LLMSettings, previous: LLMSettings): LLMSettings {
  const merged = normalizeSettings(next)
  for (const provider of Object.keys(merged.providers) as ModelProvider[]) {
    if (merged.providers[provider].apiKey === "********") {
      merged.providers[provider].apiKey = previous.providers[provider].apiKey
    }
    merged.providers[provider].extraHeaders = mergeRetainedHeaders(
      merged.providers[provider].extraHeaders,
      previous.providers[provider].extraHeaders
    )
  }
  return merged
}

