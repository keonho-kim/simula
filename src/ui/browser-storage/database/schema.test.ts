/**
 * Purpose: Verify run children survive the v2-to-v3 browser schema migration.
 * Pattern: Migration contract test.
 * Usage: Run by bun test src/ui/browser-storage/database/schema.test.ts.
 * Related: src/ui/browser-storage/database/schema.ts, src/ui/browser-storage/database/run-schema.ts
 */
import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { MIGRATE_BROWSER_SCHEMA_V3 } from "./schema"

test("v3 moves state and report into run-owned rows and preserves events", () => {
  const db = new Database(":memory:")
  try {
    db.exec(`PRAGMA foreign_keys = ON;
      CREATE TABLE runs (id TEXT PRIMARY KEY, scenario_id TEXT, status TEXT NOT NULL,
        created_at TEXT NOT NULL, manifest_json TEXT NOT NULL, state_json TEXT, report_md TEXT);
      CREATE TABLE run_events (execution_id TEXT NOT NULL, sequence INTEGER NOT NULL,
        run_id TEXT NOT NULL, round_index INTEGER, kind TEXT NOT NULL, payload_json TEXT NOT NULL,
        PRIMARY KEY (execution_id, sequence));
      CREATE INDEX run_events_round ON run_events(run_id, round_index, sequence);
      CREATE TABLE graph_frames (run_id TEXT NOT NULL, frame_index INTEGER NOT NULL,
        payload_json TEXT NOT NULL, PRIMARY KEY (run_id, frame_index));
      INSERT INTO runs VALUES ('run-1', NULL, 'completed', '2026-01-01', '{}', '{"round":1}', '# Report');
      INSERT INTO run_events VALUES ('run-1', 7, 'run-1', 1, 'round.completed', '{}');
      INSERT INTO graph_frames VALUES ('run-1', 2, '{}');
      PRAGMA user_version = 2;`)
    db.transaction(() => db.exec(MIGRATE_BROWSER_SCHEMA_V3))()
    expect(db.query("SELECT state_json FROM run_snapshots WHERE run_id = 'run-1'").get()).toEqual({ state_json: '{"round":1}' })
    expect(db.query("SELECT report_md FROM run_reports WHERE run_id = 'run-1'").get()).toEqual({ report_md: "# Report" })
    expect(db.query("SELECT sequence FROM run_events WHERE run_id = 'run-1'").get()).toEqual({ sequence: 7 })
    expect(db.query("SELECT frame_index FROM graph_frames WHERE run_id = 'run-1'").get()).toEqual({ frame_index: 2 })
    expect(db.query("PRAGMA foreign_key_check").all()).toEqual([])
    expect(db.query("PRAGMA user_version").get()).toEqual({ user_version: 3 })
    db.exec("DELETE FROM runs WHERE id = 'run-1'")
    expect(db.query("SELECT * FROM run_events").all()).toEqual([])
    expect(db.query("SELECT * FROM run_snapshots").all()).toEqual([])
  } finally { db.close() }
})
