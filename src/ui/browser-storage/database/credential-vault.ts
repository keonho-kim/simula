/**
 * Purpose: Keep provider credentials encrypted at rest in browser SQLite.
 * Pattern: Browser cryptographic boundary.
 * Usage: Unlocked once per browser session before model settings are used.
 * Related: src/ui/browser-storage/database/credentials/read-vault.ts, src/ui/browser-storage/database/credentials/save-vault.ts
 */
import type { ModelProvider } from "@/shared/model"
import { deleteVault } from "./credentials/delete-vault"
import { readVault } from "./credentials/read-vault"
import { saveVault } from "./credentials/save-vault"

const KDF_ITERATIONS = 600_000
const encoder = new TextEncoder(), decoder = new TextDecoder()

export type ProviderSecrets = Partial<Record<ModelProvider, { apiKey?: string; extraHeaders?: Record<string, string> }>>
let unlocked: { key: CryptoKey; salt: Uint8Array } | undefined
let unlockedSecrets: ProviderSecrets | undefined

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  if (!passphrase) throw new Error("A passphrase is required to protect provider credentials.")
  const source = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"])
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: KDF_ITERATIONS },
    source, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
}

export async function hasCredentialVault(): Promise<boolean> { return Boolean(await readVault()) }

export async function createCredentialVault(passphrase: string, secrets: ProviderSecrets): Promise<void> {
  if (await readVault()) throw new Error("Provider credentials are already protected; unlock them first.")
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(passphrase, salt)
  await writeVault({ key, salt }, secrets)
  unlocked = { key, salt }
  unlockedSecrets = structuredClone(secrets)
}

export async function unlockCredentialVault(passphrase: string): Promise<ProviderSecrets> {
  const row = await readVault()
  if (!row) throw new Error("No provider credentials have been saved.")
  const key = await deriveKey(passphrase, row.salt)
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: row.nonce as BufferSource }, key, row.ciphertext as BufferSource)
    const secrets = JSON.parse(decoder.decode(plain)) as ProviderSecrets
    unlocked = { key, salt: row.salt }
    unlockedSecrets = structuredClone(secrets)
    return secrets
  } catch { throw new Error("Could not unlock provider credentials. Check the passphrase.") }
}

export async function updateCredentialVault(secrets: ProviderSecrets): Promise<void> {
  if (!unlocked) throw new Error("Unlock provider credentials before saving.")
  await writeVault(unlocked, secrets)
  unlockedSecrets = structuredClone(secrets)
}

export function readUnlockedSecrets(): ProviderSecrets | undefined { return unlockedSecrets && structuredClone(unlockedSecrets) }

export function lockCredentialVault(): void { unlocked = undefined; unlockedSecrets = undefined }

export async function clearCredentialVault(): Promise<void> {
  await deleteVault()
  unlocked = undefined
  unlockedSecrets = undefined
}

async function writeVault(access: { key: CryptoKey; salt: Uint8Array }, secrets: ProviderSecrets): Promise<void> {
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource },
    access.key, encoder.encode(JSON.stringify(secrets))))
  await saveVault({ salt: access.salt, nonce, ciphertext })
}
