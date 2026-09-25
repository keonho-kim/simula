/**
 * Purpose: Execute typed SQLite ORM queries through the existing OPFS Worker.
 * Pattern: Driver adapter.
 * Usage: Imported by browser repositories; the Worker remains the sole SQLite owner.
 * Related: src/ui/browser-storage/database/client.ts, src/ui/browser-storage/database/run-schema.ts
 */
import { drizzle } from "drizzle-orm/sqlite-proxy"
import { browserDatabase } from "./connection"
import type { SqlParameter } from "./protocol"
import * as schema from "./run-schema"
import { artifacts } from "./artifact-schema"
import * as browserSchema from "./browser-schema"

const tables = { ...schema, ...browserSchema, artifacts }

export const browserOrm = drizzle(async (sql, params, method) => {
  const database = await browserDatabase()
  // Drizzle's proxy callback types params broadly; SQLite values are restricted by the Worker protocol.
  const statement = { sql, bind: params as SqlParameter[] }
  if (method === "run") {
    await database.execute([statement])
    return { rows: [] }
  }
  const rows = await database.values(statement)
  return { rows: method === "get" ? rows[0] ?? [] : rows }
}, async queries => {
  const database = await browserDatabase()
  return database.batch(queries.map(query => ({ sql: query.sql, bind: query.params as SqlParameter[], method: query.method })))
}, { schema: tables })
