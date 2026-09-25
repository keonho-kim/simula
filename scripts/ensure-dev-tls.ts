/**
 * Purpose: Create a local-only HTTPS certificate outside the repository for development.
 * Pattern: Development setup script.
 * Usage: Run by bun run dev and bun run test:e2e before their web servers start.
 * Related: server.ts, src/backend/config.ts
 */
import { chmodSync, existsSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

const directory = resolve(process.env.SIMULA_DEV_CERT_DIR ?? join(homedir(), ".config", "simula", "certs"))
const cert = join(directory, "localhost.pem")
const key = join(directory, "localhost-key.pem")
const providedCert = process.env.SIMULA_TLS_CERT_FILE
const providedKey = process.env.SIMULA_TLS_KEY_FILE

if (providedCert || providedKey) {
  if (!providedCert || !providedKey || !existsSync(providedCert) || !existsSync(providedKey)) {
    throw new Error("Set both SIMULA_TLS_CERT_FILE and SIMULA_TLS_KEY_FILE to existing certificate files.")
  }
  console.log(`HTTPS certificate: ${providedCert}`)
  process.exit(0)
}

if (!existsSync(cert) || !existsSync(key)) {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const result = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:3072", "-sha256", "-nodes",
    "-keyout", key, "-out", cert, "-days", "365", "-subj", "/CN=localhost",
    "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"], { stdio: "inherit" })
  if (result.status !== 0) throw new Error("OpenSSL could not create the local HTTPS certificate.")
}

chmodSync(key, 0o600)

console.log(`Local HTTPS certificate: ${cert}`)
