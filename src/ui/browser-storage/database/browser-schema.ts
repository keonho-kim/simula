/**
 * Purpose: Type browser-owned settings, scenarios, drafts, attachments, and credentials for ORM queries.
 * Pattern: ORM schema.
 * Usage: Imported by browser repositories through the SQLite Worker proxy.
 * Related: src/ui/browser-storage/database/schema.ts, src/ui/browser-storage/database/orm.ts
 */
import { customType, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

const bytes = customType<{ data: Uint8Array; driverData: Uint8Array }>({ dataType: () => "blob" })

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
})

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const credentials = sqliteTable("credentials", {
  provider: text("provider").primaryKey(),
  salt: bytes("salt").notNull(),
  nonce: bytes("nonce").notNull(),
  ciphertext: bytes("ciphertext").notNull(),
})

export const scenarios = sqliteTable("scenarios", {
  id: text("id").primaryKey(),
  origin: text("origin").notNull(),
  seedVersion: text("seed_version"),
  sourceName: text("source_name").notNull(),
  text: text("text").notNull(),
  controlsJson: text("controls_json").notNull(),
  updatedAt: text("updated_at").notNull(),
})

export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  ownerId: text("owner_id"),
  valueJson: text("value_json").notNull(),
  savedJson: text("saved_json"),
  updatedAt: text("updated_at").notNull(),
})

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  ownerKind: text("owner_kind").notNull(),
  ownerId: text("owner_id").notNull(),
  opfsPath: text("opfs_path").notNull(),
  name: text("name").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  mimeType: text("mime_type").notNull(),
  lastModified: integer("last_modified").notNull(),
})
