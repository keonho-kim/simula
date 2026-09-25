/**
 * Purpose: Define the narrow browser-to-SQLite-worker request and response contract.
 * Pattern: Message contract.
 * Usage: Shared by browser storage callers and its dedicated Worker.
 * Related: src/ui/browser-storage/database/worker.ts, src/ui/browser-storage/database/client.ts
 */
export type SqlParameter = string | number | null | bigint | Uint8Array | Int8Array | ArrayBuffer

export interface SqlStatement {
  sql: string
  bind?: SqlParameter[]
}

export interface SqlBatchStatement extends SqlStatement {
  method: "run" | "all" | "values" | "get"
}

export type DatabaseOperation =
  | { kind: "open" }
  | { kind: "query"; statement: SqlStatement }
  | { kind: "values"; statement: SqlStatement }
  | { kind: "batch"; statements: SqlBatchStatement[] }
  | { kind: "execute"; statements: SqlStatement[] }
  | { kind: "close" }

export interface DatabaseRequest {
  id: number
  operation: DatabaseOperation
}

export type DatabaseResponse =
  | { id: number; ok: true; rows?: Record<string, SqlParameter>[] | SqlParameter[][];
      results?: Array<{ rows: SqlParameter[] | SqlParameter[][] }> }
  | { id: number; ok: false; error: string }
