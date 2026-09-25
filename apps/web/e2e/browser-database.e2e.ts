/**
 * Purpose: Verify browser SQLite persistence, transactional writes, and indexed event reads.
 * Pattern: Browser storage integration test.
 * Usage: bun run test:e2e apps/web/e2e/browser-database.e2e.ts
 * Related: src/ui/browser-storage/database/worker.ts, src/ui/browser-storage/database/schema.ts
 */
import { expect, test } from "./fixtures"

test("startup paints before the SQLite worker finishes loading", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  let releaseWasm: (() => void) | undefined
  const blockedWasm = new Promise<void>(resolve => { releaseWasm = resolve })
  await page.route("**/*.wasm", async route => { await blockedWasm; await route.continue() })
  try {
    await page.goto("/")
    await expect(page.getByRole("status").filter({ hasText: "Opening browser storage…" })).toBeVisible()
  } finally { releaseWasm?.() }
  await expect(page.getByRole("button", { name: /New Scenario/ })).toBeVisible()
})

test("SQLite WASM persists browser records across page reload", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  const id = await page.evaluate(async () => {
    const moduleUrl = "/src/ui/browser-storage/database/connection.ts"
    const { browserDatabase } = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/browser-storage/database/connection")
    const first = await browserDatabase()
    const id = crypto.randomUUID()
    await first.execute([{ sql: "INSERT INTO drafts(id, kind, value_json, updated_at) VALUES (?, ?, ?, ?)", bind: [id, "scenario", "{}", new Date().toISOString()] }])
    return id
  })
  await page.reload()
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  const result = await page.evaluate(async id => {
    const moduleUrl = "/src/ui/browser-storage/database/connection.ts"
    const { browserDatabase } = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/browser-storage/database/connection")
    const second = await browserDatabase()
    const rows = await second.query<{ id: string; kind: string }>({ sql: "SELECT id, kind FROM drafts WHERE id = ?", bind: [id] })
    await second.execute([{ sql: "DELETE FROM drafts WHERE id = ?", bind: [id] }])
    return rows
  }, id)
  expect(result).toHaveLength(1)
  expect(result[0]?.kind).toBe("scenario")
})

test("draft discard restores a saved copy and removes an unsaved draft", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  const result = await page.evaluate(async () => {
    const drafts = await window.__simulaE2E!.import("/src/ui/shell/e2e-queries/drafts.ts") as typeof import("@/ui/shell/e2e-queries/drafts")
    const savedId = crypto.randomUUID(), unsavedId = crypto.randomUUID()
    await drafts.saveDraft(savedId, "scenario", { title: "saved" })
    await drafts.writeWorkingDraft(savedId, "scenario", { title: "changed" })
    await drafts.writeWorkingDraft(unsavedId, "scenario", { title: "unsaved" })
    await drafts.discardWorkingDraft(savedId)
    await drafts.discardWorkingDraft(unsavedId)
    const restored = await drafts.readDraft<{ title: string }>(savedId)
    const removed = await drafts.readDraft(unsavedId)
    await drafts.deleteDraft(savedId)
    return { restored, removed }
  })
  expect(result.restored).toEqual({ working: { title: "saved" }, saved: { title: "saved" } })
  expect(result.removed).toBeUndefined()
})

test("browser run events deduplicate and load by round", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  const result = await page.evaluate(async () => {
    const moduleUrl = "/src/ui/shell/e2e-queries/runs.ts"
    const repository = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/shell/e2e-queries/runs")
    const runId = crypto.randomUUID(), timestamp = new Date().toISOString()
    await repository.saveRunManifest({ id: runId, status: "running", createdAt: timestamp,
      artifactPaths: { manifest: "", state: "", events: "", timeline: "", report: "" } })
    const event = { type: "round.completed" as const, runId, timestamp, roundIndex: 3 }
    await repository.appendRunEvents(runId, [{ sequence: 10, event }, { sequence: 10, event }])
    return { runs: await repository.listBrowserRuns(), events: await repository.readRoundEvents(runId, 3),
      last: await repository.lastRunEventSequence(runId) }
  })
  expect(result.runs).toHaveLength(1)
  expect(result.events).toHaveLength(1)
  expect(result.last).toBe(10)
})

test("final run detail replaces stream offsets with complete indexed round history", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  const result = await page.evaluate(async () => {
    const moduleUrl = "/src/ui/shell/e2e-queries/runs.ts"
    const repository = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/shell/e2e-queries/runs")
    const runId = crypto.randomUUID(), timestamp = new Date().toISOString()
    const paths = { manifest: "", state: "", events: "", timeline: "", report: "" }
    await repository.saveRunManifest({ id: runId, status: "running", createdAt: timestamp, artifactPaths: paths })
    const event = { type: "event.injected" as const, runId, timestamp,
      event: { id: "event-1", roundIndex: 2, sourceEventId: "source", title: "Event", summary: "Something happens" } }
    await repository.appendRunEvents(runId, [{ sequence: 120, event }])
    const before = await repository.readRoundEvents(runId, 2)
    await repository.saveRunDetail({ run: { id: runId, status: "completed", createdAt: timestamp, artifactPaths: paths },
      timeline: [], events: [event, { type: "round.completed", runId, timestamp, roundIndex: 2 }] })
    await repository.appendRunEvents(runId, [{ sequence: 240, event }])
    const after = await repository.readRoundEvents(runId, 2)
    const loaded = await repository.readBrowserRun(runId)
    return { before: before.length, after: after.length, loaded: loaded?.events.length }
  })
  expect(result).toEqual({ before: 1, after: 2, loaded: 2 })
})

test("provider secrets are encrypted and require the passphrase after locking", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  const result = await page.evaluate(async () => {
    const vaultUrl = "/src/ui/browser-storage/database/credential-vault.ts"
    const dbUrl = "/src/ui/browser-storage/database/connection.ts"
    const vault = await window.__simulaE2E!.import(vaultUrl) as typeof import("@/ui/browser-storage/database/credential-vault")
    const { browserDatabase } = await window.__simulaE2E!.import(dbUrl) as typeof import("@/ui/browser-storage/database/connection")
    await vault.createCredentialVault("long test passphrase", { openai: { apiKey: "private-key-123" } })
    const raw = await (await browserDatabase()).query<{ ciphertext: Uint8Array }>({ sql: "SELECT ciphertext FROM credentials WHERE provider = ?", bind: ["provider-credentials"] })
    vault.lockCredentialVault()
    let wrongRejected = false
    try { await vault.unlockCredentialVault("wrong passphrase") } catch { wrongRejected = true }
    const restored = await vault.unlockCredentialVault("long test passphrase")
    await vault.clearCredentialVault()
    return { wrongRejected, restored, plaintextVisible: new TextDecoder().decode(raw[0]?.ciphertext).includes("private-key-123") }
  })
  expect(result.wrongRejected).toBe(true)
  expect(result.restored.openai?.apiKey).toBe("private-key-123")
  expect(result.plaintextVisible).toBe(false)
})

test("a database from a newer app version shows a storage error instead of resetting data", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "ko"))
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.evaluate(async () => {
    const moduleUrl = "/src/ui/browser-storage/database/connection.ts"
    const { browserDatabase } = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/browser-storage/database/connection")
    await (await browserDatabase()).execute([{ sql: "PRAGMA user_version = 999" }])
  })
  await page.reload()
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await expect(page.getByRole("heading", { name: "브라우저 저장소를 사용할 수 없습니다" })).toBeVisible()
  await expect(page.getByText("Browser data was written by a newer Simula version.")).toBeVisible()
})

test("an existing v1 database upgrades attachment metadata without deleting records", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  const id = await page.evaluate(async () => {
    const moduleUrl = "/src/ui/browser-storage/database/connection.ts"
    const { browserDatabase } = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/browser-storage/database/connection")
    const db = await browserDatabase(), id = crypto.randomUUID()
    await db.execute([{ sql: "INSERT INTO drafts(id, kind, value_json, updated_at) VALUES (?, ?, ?, ?)",
      bind: [id, "scenario", "{}", new Date().toISOString()] },
    { sql: "DROP TABLE run_events" },
    { sql: "DROP TABLE graph_frames" },
    { sql: "DROP TABLE run_snapshots" },
    { sql: "DROP TABLE run_reports" },
    { sql: "ALTER TABLE runs ADD COLUMN state_json TEXT" },
    { sql: "ALTER TABLE runs ADD COLUMN report_md TEXT" },
    { sql: `CREATE TABLE run_events (execution_id TEXT NOT NULL, sequence INTEGER NOT NULL,
      run_id TEXT NOT NULL, round_index INTEGER, kind TEXT NOT NULL, payload_json TEXT NOT NULL,
      PRIMARY KEY (execution_id, sequence))` },
    { sql: "CREATE INDEX run_events_round ON run_events(run_id, round_index, sequence)" },
    { sql: `CREATE TABLE graph_frames (run_id TEXT NOT NULL, frame_index INTEGER NOT NULL,
      payload_json TEXT NOT NULL, PRIMARY KEY (run_id, frame_index))` },
    { sql: "ALTER TABLE attachments DROP COLUMN last_modified" },
    { sql: "ALTER TABLE attachments DROP COLUMN mime_type" },
    { sql: "PRAGMA user_version = 1" }])
    return id
  })
  await page.reload()
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  const result = await page.evaluate(async draftId => {
    const moduleUrl = "/src/ui/browser-storage/database/connection.ts"
    const { browserDatabase } = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/browser-storage/database/connection")
    const db = await browserDatabase()
    const version = await db.query<{ user_version: number }>({ sql: "PRAGMA user_version" })
    const columns = await db.query<{ name: string }>({ sql: "PRAGMA table_info(attachments)" })
    const draft = await db.query<{ id: string }>({ sql: "SELECT id FROM drafts WHERE id = ?", bind: [draftId] })
    return { version: version[0]?.user_version, columns: columns.map(column => column.name), retained: draft.length }
  }, id)
  expect(result.version).toBe(3)
  expect(result.columns).toContain("mime_type")
  expect(result.columns).toContain("last_modified")
  expect(result.retained).toBe(1)
})

test("a 20 MiB source remains in OPFS with SQLite ownership metadata", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  const result = await page.evaluate(async () => {
    const attachmentUrl = "/src/ui/shell/e2e-queries/attachments.ts", databaseUrl = "/src/ui/browser-storage/database/connection.ts"
    const attachments = await window.__simulaE2E!.import(attachmentUrl) as typeof import("@/ui/shell/e2e-queries/attachments")
    const { browserDatabase } = await window.__simulaE2E!.import(databaseUrl) as typeof import("@/ui/browser-storage/database/connection")
    const source = new File([new Uint8Array(20 * 1024 * 1024)], "large.pdf", { type: "application/pdf" })
    const saved = await attachments.storeAttachment(source)
    const restored = await attachments.readAttachment(saved)
    const rows = await (await browserDatabase()).query<{ owner_id: string; size_bytes: number }>({
      sql: "SELECT owner_id, size_bytes FROM attachments WHERE id = ?", bind: [saved.id] })
    await attachments.deleteAttachment(saved.id)
    return { size: restored.size, metadata: rows[0] }
  })
  expect(result.size).toBe(20 * 1024 * 1024)
  expect(result.metadata).toEqual({ owner_id: "new-scenario", size_bytes: 20 * 1024 * 1024 })
})

test("a failed SQLite write rolls back the batch and never reports success", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  const result = await page.evaluate(async () => {
    const moduleUrl = "/src/ui/browser-storage/database/connection.ts"
    const { browserDatabase } = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/browser-storage/database/connection")
    const db = await browserDatabase(), id = crypto.randomUUID()
    let rejected = false
    try {
      await db.execute([{ sql: "INSERT INTO drafts(id, kind, value_json, updated_at) VALUES (?, ?, ?, ?)",
        bind: [id, "scenario", "{}", new Date().toISOString()] },
      { sql: "INSERT INTO scenarios(id, origin, source_name, text, controls_json, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        bind: [id, "invalid", "source", "text", "{}", new Date().toISOString()] }])
    } catch { rejected = true }
    const rows = await db.query<{ id: string }>({ sql: "SELECT id FROM drafts WHERE id = ?", bind: [id] })
    return { rejected, persisted: rows.length }
  })
  expect(result).toEqual({ rejected: true, persisted: 0 })
})

test("a server restart leaves a browser-saved running run marked interrupted", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  const runId = await page.evaluate(async () => {
    const moduleUrl = "/src/ui/shell/e2e-queries/runs.ts"
    const repository = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/shell/e2e-queries/runs")
    const id = crypto.randomUUID()
    await repository.saveRunManifest({ id, status: "running", createdAt: new Date().toISOString(),
      artifactPaths: { manifest: "", state: "", events: "", timeline: "", report: "" } })
    return id
  })
  await page.route(url => url.pathname === "/api/runs", route => route.fulfill({ json: { runs: [] } }))
  const status = await page.evaluate(async id => {
    const moduleUrl = "/src/ui/api-client/client.ts"
    const { fetchRuns } = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/api-client/client")
    return (await fetchRuns()).find(run => run.id === id)?.status
  }, runId)
  expect(status).toBe("interrupted")
})

test("the landing history does not load full run detail until a run is opened", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "ko"))
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  const id = await page.evaluate(async () => {
    const repository = await window.__simulaE2E!.import("/src/ui/shell/e2e-queries/runs.ts") as typeof import("@/ui/shell/e2e-queries/runs")
    const id = crypto.randomUUID()
    await repository.saveRunManifest({ id, status: "completed", createdAt: new Date().toISOString(),
      scenarioName: "기록 조회 검사", artifactPaths: { manifest: "", state: "", events: "", timeline: "", report: "" } })
    return id
  })
  let detailRequests = 0
  page.on("request", request => { if (new URL(request.url()).pathname === `/api/runs/${id}`) detailRequests++ })
  await page.reload()
  await page.getByRole("button", { name: /실행 내역 보기/ }).click()
  const history = page.getByRole("dialog", { name: "실행 내역" })
  await expect(history.getByText("기록 조회 검사")).toBeVisible()
  expect(detailRequests).toBe(0)
  await history.getByRole("button", { name: "열기" }).click()
  await expect.poll(() => detailRequests).toBeGreaterThan(0)
})
