/**
 * Purpose: Define browser-owned SQLite DDL and versioned data migrations.
 * Pattern: Declarative schema.
 * Usage: Executed once by the SQLite Worker when opening an origin database.
 * Related: src/ui/browser-storage/database/worker.ts, src/ui/browser-storage/database/browser-schema.ts
 */
export const BROWSER_SCHEMA_VERSION = 3

export const MIGRATE_BROWSER_SCHEMA_V2 = `
ALTER TABLE attachments ADD COLUMN mime_type TEXT NOT NULL DEFAULT '';
ALTER TABLE attachments ADD COLUMN last_modified INTEGER NOT NULL DEFAULT 0;
PRAGMA user_version = 2;
`

export const MIGRATE_BROWSER_SCHEMA_V3 = `
CREATE TABLE run_snapshots (
  run_id TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
  state_json TEXT NOT NULL
);
CREATE TABLE run_reports (
  run_id TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
  report_md TEXT NOT NULL
);
INSERT INTO run_snapshots(run_id, state_json)
  SELECT id, state_json FROM runs WHERE state_json IS NOT NULL;
INSERT INTO run_reports(run_id, report_md)
  SELECT id, report_md FROM runs WHERE report_md IS NOT NULL;
ALTER TABLE runs DROP COLUMN state_json;
ALTER TABLE runs DROP COLUMN report_md;
ALTER TABLE run_events RENAME TO legacy_run_events;
ALTER TABLE graph_frames RENAME TO legacy_graph_frames;
CREATE TABLE run_events (
  execution_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  round_index INTEGER,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (execution_id, sequence)
);
INSERT INTO run_events SELECT * FROM legacy_run_events
  WHERE run_id IN (SELECT id FROM runs);
DROP TABLE legacy_run_events;
CREATE INDEX run_events_round ON run_events(run_id, round_index, sequence);
CREATE TABLE graph_frames (
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  frame_index INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (run_id, frame_index)
);
INSERT INTO graph_frames SELECT * FROM legacy_graph_frames
  WHERE run_id IN (SELECT id FROM runs);
DROP TABLE legacy_graph_frames;
PRAGMA user_version = 3;
`

export const CREATE_BROWSER_SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS credentials (
  provider TEXT PRIMARY KEY,
  salt BLOB NOT NULL,
  nonce BLOB NOT NULL,
  ciphertext BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS scenarios (
  id TEXT PRIMARY KEY,
  origin TEXT NOT NULL CHECK(origin IN ('sample', 'user')),
  seed_version TEXT,
  source_name TEXT NOT NULL,
  text TEXT NOT NULL,
  controls_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  owner_id TEXT,
  value_json TEXT NOT NULL,
  saved_json TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  owner_kind TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  opfs_path TEXT NOT NULL,
  name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  last_modified INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS artifacts_owner ON artifacts(owner_id, kind);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  scenario_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  manifest_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_recent ON runs(created_at DESC, id);
CREATE TABLE IF NOT EXISTS run_snapshots (
  run_id TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
  state_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS run_reports (
  run_id TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
  report_md TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS run_events (
  execution_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  round_index INTEGER,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (execution_id, sequence)
);
CREATE INDEX IF NOT EXISTS run_events_round ON run_events(run_id, round_index, sequence);
CREATE TABLE IF NOT EXISTS graph_frames (
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  frame_index INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  PRIMARY KEY (run_id, frame_index)
);
PRAGMA user_version = 3;
`
