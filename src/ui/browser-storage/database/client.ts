/**
 * Purpose: Call the dedicated SQLite worker without blocking React rendering.
 * Pattern: Worker request adapter.
 * Usage: Opened by the browser storage bootstrap and consumed by narrow repositories.
 * Related: src/ui/browser-storage/database/worker.ts, src/ui/browser-storage/database/protocol.ts
 */
import type { DatabaseOperation, DatabaseResponse, SqlBatchStatement, SqlParameter, SqlStatement } from "./protocol"

export class BrowserDatabase {
  private readonly worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })
  private nextId = 0
  private readonly pending = new Map<number, { resolve: (response: DatabaseResponse) => void; reject: (error: Error) => void }>()

  constructor() {
    this.worker.onmessage = (event: MessageEvent<DatabaseResponse>) => {
      const task = this.pending.get(event.data.id)
      if (!task) return
      this.pending.delete(event.data.id)
      task.resolve(event.data)
    }
    this.worker.onerror = () => this.failPending(new Error("Browser storage worker stopped."))
  }

  async open(): Promise<void> { await this.call({ kind: "open" }) }

  async query<T extends object>(statement: SqlStatement): Promise<T[]> {
    const response = await this.call({ kind: "query", statement })
    return response.rows as T[] ?? []
  }

  async values(statement: SqlStatement): Promise<SqlParameter[][]> {
    const response = await this.call({ kind: "values", statement })
    return response.rows as SqlParameter[][] ?? []
  }

  async batch(statements: SqlBatchStatement[]): Promise<Array<{ rows: SqlParameter[] | SqlParameter[][] }>> {
    const response = await this.call({ kind: "batch", statements })
    return response.results ?? []
  }

  async execute(statements: SqlStatement[]): Promise<void> { await this.call({ kind: "execute", statements }) }

  async close(): Promise<void> {
    try { await this.call({ kind: "close" }) }
    finally { this.worker.terminate(); this.failPending(new Error("Browser storage closed.")) }
  }

  private async call(operation: DatabaseOperation): Promise<Extract<DatabaseResponse, { ok: true }>> {
    const id = ++this.nextId
    const result = new Promise<DatabaseResponse>((resolve, reject) => this.pending.set(id, { resolve, reject }))
    this.worker.postMessage({ id, operation })
    const response = await result
    if (!response.ok) throw new Error(response.error)
    return response
  }

  private failPending(error: Error): void {
    for (const task of this.pending.values()) task.reject(error)
    this.pending.clear()
  }
}
