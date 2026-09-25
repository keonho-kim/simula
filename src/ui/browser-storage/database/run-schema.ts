/**
 * Purpose: Type the run-owned relational tables used by browser repositories.
 * Pattern: ORM schema.
 * Usage: Imported by run repositories through the SQLite Worker proxy.
 * Related: src/ui/browser-storage/database/schema.ts, src/ui/browser-storage/database/runs/save-detail.ts
 */
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { desc } from "drizzle-orm"

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  scenarioId: text("scenario_id"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  manifestJson: text("manifest_json").notNull(),
}, table => [index("runs_recent").on(desc(table.createdAt), table.id)])

export const runSnapshots = sqliteTable("run_snapshots", {
  runId: text("run_id").primaryKey().references(() => runs.id, { onDelete: "cascade" }),
  stateJson: text("state_json").notNull(),
})

export const runReports = sqliteTable("run_reports", {
  runId: text("run_id").primaryKey().references(() => runs.id, { onDelete: "cascade" }),
  reportMd: text("report_md").notNull(),
})

export const runEvents = sqliteTable("run_events", {
  executionId: text("execution_id").notNull(),
  sequence: integer("sequence").notNull(),
  runId: text("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  roundIndex: integer("round_index"),
  kind: text("kind").notNull(),
  payloadJson: text("payload_json").notNull(),
}, table => [primaryKey({ columns: [table.executionId, table.sequence] }),
  index("run_events_round").on(table.runId, table.roundIndex, table.sequence)])

export const graphFrames = sqliteTable("graph_frames", {
  runId: text("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  frameIndex: integer("frame_index").notNull(),
  payloadJson: text("payload_json").notNull(),
}, table => [primaryKey({ columns: [table.runId, table.frameIndex] })])
