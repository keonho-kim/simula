/**
 * Purpose: Reuse one browser SQLite connection for the lifetime of the owning tab.
 * Pattern: Lifecycle-scoped connection provider.
 * Usage: Called by browser repositories after the application has obtained its tab lock.
 * Related: src/ui/browser-storage/database/client.ts, src/ui/browser-storage/database/orm.ts
 */
import { BrowserDatabase } from "./client"

let pending: Promise<BrowserDatabase> | undefined

export function browserDatabase(): Promise<BrowserDatabase> {
  if (!pending) {
    const database = new BrowserDatabase()
    pending = database.open().then(() => database).catch(async error => {
      pending = undefined
      await database.close()
      throw error
    })
  }
  return pending
}
