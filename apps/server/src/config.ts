import { join } from "node:path"

export const PORT = Number(process.env.PORT ?? 3001)
export const DATA_ROOT = process.env.SIMULA_DATA_DIR ?? join(process.cwd(), "runs")
export const SETTINGS_PATH = process.env.SIMULA_SETTINGS_PATH ?? join(process.cwd(), "settings.json")
export const ENV_TOML_PATH = process.env.SIMULA_ENV_TOML_PATH ?? join(process.cwd(), "env.toml")
export const SAMPLE_ROOT = process.env.SIMULA_SAMPLE_DIR ?? join(import.meta.dirname, "../../..", "senario.samples")

