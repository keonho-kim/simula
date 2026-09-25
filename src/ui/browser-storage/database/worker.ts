/**
 * Purpose: Own one persistent SQLite WASM connection and execute bounded browser requests.
 * Pattern: Worker-owned Repository Adapter.
 * Usage: Created by src/ui/browser-storage/database/client.ts after the single-tab lock is acquired.
 * Related: src/ui/browser-storage/database/protocol.ts, src/ui/browser-storage/database/schema.ts
 */
import sqlite3InitModule, { type OpfsSAHPoolDatabase } from "@sqlite.org/sqlite-wasm"
import type { DatabaseRequest, DatabaseResponse, SqlBatchStatement, SqlParameter, SqlStatement } from "./protocol"
import { BROWSER_SCHEMA_VERSION, CREATE_BROWSER_SCHEMA, MIGRATE_BROWSER_SCHEMA_V2, MIGRATE_BROWSER_SCHEMA_V3 } from "./schema"

let database: OpfsSAHPoolDatabase | undefined

function requireDatabase(): OpfsSAHPoolDatabase {
  if (!database) throw new Error("Browser storage is not open.")
  return database
}

function rows(statement: SqlStatement): Record<string, SqlParameter>[] {
  return requireDatabase().exec({ sql: statement.sql, bind: statement.bind, rowMode: "object", returnValue: "resultRows" })
}

function values(statement: SqlStatement): SqlParameter[][] {
  return requireDatabase().exec({ sql: statement.sql, bind: statement.bind, rowMode: "array", returnValue: "resultRows" })
}

function batch(statements: SqlBatchStatement[]): Array<{ rows: SqlParameter[] | SqlParameter[][] }> {
  const results: Array<{ rows: SqlParameter[] | SqlParameter[][] }> = []
  requireDatabase().transaction(() => {
    for (const statement of statements) {
      const found = values(statement)
      results.push({ rows: statement.method === "get" ? found[0] ?? [] : found })
    }
  })
  return results
}

async function openDatabase(): Promise<void> {
  if (database) return
  if (!navigator.storage?.getDirectory) throw new Error("This browser does not support persistent OPFS storage.")
  // SQLite's other OPFS VFSes start proxy workers that this SAH-pool-only client never uses.
  // Disabling them avoids their startup timeout in WebKit while retaining persistent SAH-pool storage.
  const sqliteGlobals = globalThis as typeof globalThis & { sqlite3ApiConfig?: { disable: { vfs: Record<string, boolean> } } }
  sqliteGlobals.sqlite3ApiConfig = { disable: { vfs: { opfs: true, "opfs-wl": true } } }
  const sqlite = await sqlite3InitModule()
  const pool = await sqlite.installOpfsSAHPoolVfs({ directory: "/simula-sqlite" })
  const opened = new pool.OpfsSAHPoolDb("/simula.sqlite")
  try {
    opened.exec("PRAGMA foreign_keys = ON")
    const version = Number(opened.selectValue("PRAGMA user_version") ?? 0)
    if (version > BROWSER_SCHEMA_VERSION) throw new Error("Browser data was written by a newer Simula version.")
    if (version === 0) opened.exec(CREATE_BROWSER_SCHEMA)
    if (version === 1) opened.transaction(() => opened.exec(MIGRATE_BROWSER_SCHEMA_V2))
    if (version === 1 || version === 2) opened.transaction(() => opened.exec(MIGRATE_BROWSER_SCHEMA_V3))
    database = opened
  } catch (error) { opened.close(); throw error }
}

function execute(statements: SqlStatement[]): void {
  if (!statements.length) return
  requireDatabase().transaction(() => {
    for (const statement of statements) requireDatabase().exec({ sql: statement.sql, bind: statement.bind })
  })
}

self.onmessage = async (message: MessageEvent<DatabaseRequest>) => {
  const { id, operation } = message.data
  let response: DatabaseResponse
  try {
    switch (operation.kind) {
      case "open": await openDatabase(); response = { id, ok: true }; break
      case "query": response = { id, ok: true, rows: rows(operation.statement) }; break
      case "values": response = { id, ok: true, rows: values(operation.statement) }; break
      case "batch": response = { id, ok: true, results: batch(operation.statements) }; break
      case "execute": execute(operation.statements); response = { id, ok: true }; break
      case "close": database?.close(); database = undefined; response = { id, ok: true }; break
    }
  } catch (error) {
    response = { id, ok: false, error: error instanceof Error ? error.message : "Browser storage failed." }
  }
  self.postMessage(response)
}
