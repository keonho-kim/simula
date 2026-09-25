/**
 * Purpose: Type browser-owned generation artifacts for repository queries.
 * Pattern: ORM schema.
 * Usage: Imported by artifact and run repositories.
 * Related: src/ui/browser-storage/database/schema.ts, src/ui/browser-storage/database/artifacts/save.ts
 */
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const artifacts = sqliteTable("artifacts", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  ownerId: text("owner_id").notNull(),
  status: text("status").notNull(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull(),
}, table => [index("artifacts_owner").on(table.ownerId, table.kind)])
