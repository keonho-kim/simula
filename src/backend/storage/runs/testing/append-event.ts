/**
 * Purpose: Append an accepted run event from a separate process for stream tests.
 * Pattern: Test-only process fixture.
 * Usage: Spawned by api/event-stream.test.ts with an isolated run root and ID.
 * Related: src/backend/api/runs/event-stream.test.ts, src/backend/storage/runs/run-store.ts
 */
import { RunStore } from "../run-store"

const root = process.argv[2], runId = process.argv[3]
if (!root || !runId) throw new Error("Missing temporary run scope")
const store = new RunStore({ rootDir: root })
const lease = store.execution(runId).claim()
if (!lease) throw new Error("Run already owned")
try { await store.appendEvent({ type: "log", runId, timestamp: new Date().toISOString(), level: "info", message: "remote" }, lease) }
finally { lease.release() }
