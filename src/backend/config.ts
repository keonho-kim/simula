/**
 * Purpose: Resolve server settings, storage paths, and external converter configuration.
 * Pattern: Runtime configuration.
 * Usage: Imported by backend composition and I/O adapters.
 * Related: server.ts, src/backend/integrations/documents/office-pdf.ts
 */
import { resolve } from "node:path"
import { homedir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

// Anchor runtime paths to this checkout, not the package script's working directory.
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url))

export const PORT = Number(process.env.PORT ?? 3001)
const devCertDir = resolve(process.env.SIMULA_DEV_CERT_DIR ?? join(homedir(), ".config", "simula", "certs"))
export const TLS_CERT_FILE = process.env.SIMULA_TLS_CERT_FILE ?? (process.env.SIMULA_HTTPS === "1" ? join(devCertDir, "localhost.pem") : undefined)
export const TLS_KEY_FILE = process.env.SIMULA_TLS_KEY_FILE ?? (process.env.SIMULA_HTTPS === "1" ? join(devCertDir, "localhost-key.pem") : undefined)
export const SAMPLE_ROOT = resolve(repositoryRoot, process.env.SIMULA_SAMPLE_DIR ?? "senario.samples")
export const LIBREOFFICE_BIN = process.env.SIMULA_LIBREOFFICE_BIN ?? "soffice"
export const MODEL_QUEUE_LIMIT = positiveInteger("SIMULA_MODEL_QUEUE_LIMIT", 1024)
export const MODEL_QUEUE_TIMEOUT_MS = positiveInteger("SIMULA_MODEL_QUEUE_TIMEOUT_MS", 120_000)

function positiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback)
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`)
  return value
}
