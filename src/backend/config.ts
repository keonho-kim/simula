import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

// Anchor runtime paths to this checkout, not the package script's working directory.
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url))

export const PORT = Number(process.env.PORT ?? 3001)
export const DATA_ROOT = resolve(repositoryRoot, process.env.SIMULA_DATA_DIR ?? "runs")
export const SETTINGS_PATH = resolve(repositoryRoot, process.env.SIMULA_SETTINGS_PATH ?? "settings.json")
export const ENV_TOML_PATH = resolve(repositoryRoot, process.env.SIMULA_ENV_TOML_PATH ?? "env.toml")
export const SAMPLE_ROOT = resolve(repositoryRoot, process.env.SIMULA_SAMPLE_DIR ?? "senario.samples")
