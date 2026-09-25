/**
 * Purpose: Export and restore browser SQLite rows with their OPFS source files.
 * Pattern: Portable backup adapter.
 * Usage: Invoked from the landing page backup actions.
 * Related: src/ui/browser-storage/database/schema.ts, src/ui/browser-storage/database/attachments/opfs.ts
 */
import { Zip, ZipDeflate, ZipPassThrough, unzipSync } from "fflate"
import { browserDatabase } from "./database/connection"
import type { SqlParameter, SqlStatement } from "./database/protocol"
import { lockCredentialVault } from "./database/credential-vault"

const BACKUP_VERSION = 2
const MAX_BACKUP_BYTES = 1024 * 1024 * 1024
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
const TABLES = ["app_meta", "settings", "credentials", "scenarios", "drafts", "attachments", "artifacts", "runs",
  "run_snapshots", "run_reports", "run_events", "graph_frames"] as const
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export async function exportBrowserBackup(): Promise<Blob> {
  const pieces: BlobPart[] = []
  let settle!: () => void
  let reject!: (error: Error) => void
  const done = new Promise<void>((resolve, fail) => { settle = resolve; reject = fail })
  const archive = new Zip((error, chunk, final) => {
    if (error) { reject(error); return }
    if (chunk.length) pieces.push(new Uint8Array(chunk))
    if (final) settle()
  })
  try {
    const manifest = new ZipDeflate("manifest.json", { level: 3 })
    archive.add(manifest)
    manifest.push(encoder.encode(JSON.stringify({ format: "simula-browser-backup", version: BACKUP_VERSION })), true)
    const db = await browserDatabase()
    for (const table of TABLES) {
      const entry = new ZipDeflate(`db/${table}.jsonl`, { level: 3 })
      archive.add(entry)
      let cursor = 0
      for (;;) {
        const rows = await db.query<Record<string, SqlParameter>>({ sql: `SELECT rowid AS _backup_rowid, * FROM ${table} WHERE rowid > ? ORDER BY rowid LIMIT 200`, bind: [cursor] })
        if (!rows.length) break
        cursor = Number(rows.at(-1)!._backup_rowid)
        const lines = rows.map(row => `${JSON.stringify(encodeRow(row))}\n`).join("")
        entry.push(encoder.encode(lines))
      }
      entry.push(new Uint8Array(), true)
    }
    const uploads = await navigator.storage.getDirectory().then(root => root.getDirectoryHandle("simula-uploads", { create: true }))
    for await (const [name, handle] of uploads.entries()) {
      if (handle.kind !== "file" || !/^[a-f0-9-]{36}$/.test(name)) continue
      const entry = new ZipPassThrough(`uploads/${name}`)
      archive.add(entry)
      const reader = (await handle.getFile()).stream().getReader()
      try {
        for (;;) {
          const { done: finished, value } = await reader.read()
          if (finished) break
          entry.push(value)
        }
      } finally { reader.releaseLock() }
      entry.push(new Uint8Array(), true)
    }
    archive.end()
    await done
    return new Blob(pieces, { type: "application/zip" })
  } catch (error) {
    archive.terminate()
    throw error
  }
}

export async function importBrowserBackup(file: File): Promise<void> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error("Backup exceeds the supported size.")
  let expandedBytes = 0
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: entry => {
    const expected = entry.name === "manifest.json" || TABLES.some(table => entry.name === `db/${table}.jsonl`) ||
      /^uploads\/[a-f0-9-]{36}$/.test(entry.name)
    if (!expected || entry.originalSize < 0 || (entry.name.startsWith("uploads/") && entry.originalSize > MAX_UPLOAD_BYTES)) {
      throw new Error("Backup contains an unsupported entry.")
    }
    expandedBytes += entry.originalSize
    if (expandedBytes > MAX_BACKUP_BYTES) throw new Error("Backup expands beyond the supported size.")
    return true
  } })
  const manifestBytes = files["manifest.json"]
  if (!manifestBytes) throw new Error("This is not a Simula browser backup.")
  const manifest: unknown = JSON.parse(decoder.decode(manifestBytes))
  if (!manifest || typeof manifest !== "object" || !("format" in manifest) || manifest.format !== "simula-browser-backup" ||
    !("version" in manifest) || (manifest.version !== 1 && manifest.version !== BACKUP_VERSION)) throw new Error("Unsupported backup version.")
  const db = await browserDatabase()
  const statements: SqlStatement[] = []
  for (const table of TABLES) {
    if (manifest.version === 1 && (table === "run_snapshots" || table === "run_reports")) continue
    const bytes = files[`db/${table}.jsonl`]
    if (!bytes) throw new Error(`Backup is missing ${table}.`)
    statements.push({ sql: `DELETE FROM ${table}` })
    for (const line of decoder.decode(bytes).split("\n")) {
      if (!line) continue
      const row = decodeRow(JSON.parse(line) as unknown)
      if (manifest.version === 1 && table === "runs") {
        const state = row.state_json, report = row.report_md
        delete row.state_json; delete row.report_md
        statements.push(insertBackupRow(table, row))
        if (typeof state === "string") statements.push(insertBackupRow("run_snapshots", { run_id: row.id, state_json: state }))
        if (typeof report === "string") statements.push(insertBackupRow("run_reports", { run_id: row.id, report_md: report }))
        continue
      }
      statements.push(insertBackupRow(table, row))
    }
  }
  const uploads = await navigator.storage.getDirectory().then(root => root.getDirectoryHandle("simula-uploads", { create: true }))
  for (const [path, bytes] of Object.entries(files)) {
    if (!path.startsWith("uploads/")) continue
    const id = path.slice("uploads/".length)
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Backup contains an invalid upload path.")
    const writer = await (await uploads.getFileHandle(id, { create: true })).createWritable()
    await writer.write(bytes as FileSystemWriteChunkType)
    await writer.close()
  }
  await db.execute(statements)
  lockCredentialVault()
}

function insertBackupRow(table: string, row: Record<string, SqlParameter>): SqlStatement {
  const columns = Object.keys(row)
  if (!columns.length || columns.some(column => !/^[a-z_]+$/.test(column))) throw new Error("Backup contains invalid columns.")
  return { sql: `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
    bind: columns.map(column => row[column]) }
}

function encodeRow(row: Record<string, SqlParameter>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => key !== "_backup_rowid")
    .map(([key, value]) => [key, value instanceof Uint8Array ? { blob: bytesToBase64(value) } : value]))
}

function decodeRow(value: unknown): Record<string, SqlParameter> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Backup row is invalid.")
  const output: Record<string, SqlParameter> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (raw === null || typeof raw === "string" || typeof raw === "number") output[key] = raw
    else if (raw && typeof raw === "object" && "blob" in raw && typeof raw.blob === "string") output[key] = base64ToBytes(raw.blob)
    else throw new Error("Backup row value is invalid.")
  }
  return output
}

function bytesToBase64(bytes: Uint8Array): string {
  let result = ""
  for (let i = 0; i < bytes.length; i += 0x8000) result += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(result)
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0))
}
