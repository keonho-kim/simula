/**
 * Purpose: Verify document-grounded upload, optional cast, review, and responsive resume.
 * Pattern: Browser workflow test with the deterministic server model.
 * Usage: bun run test:e2e apps/web/e2e/document-scenario.e2e.ts
 * Related: src/ui/components/scenario-builder/scenario-builder-dialog.tsx
 */
import { expect, test } from "./fixtures"

test.beforeEach(async ({ page }) => {
  const { settings } = await (await page.request.get("/api/settings")).json()
  settings.providers.openai.apiKey = "unit-test-api-key"
  settings.roles.storyBuilder.provider = "openai"
  settings.concurrency = 4
  await page.request.put("/api/settings", { data: { settings } })
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
})

test("one new-scenario modal builds from a situation without an uploaded file", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.getByRole("button", { name: /New Scenario/ }).click()
  const builder = page.getByRole("dialog", { name: "New Scenario" })
  await expect(builder.getByLabel("Choose files")).toBeAttached()
  await builder.getByLabel("Situation to simulate · optional").fill("The CTO and Finance decide whether to approve an investment at a meeting.")
  await expect(builder.getByRole("button", { name: "Run", exact: true })).toBeEnabled()
  const buildStarted = page.waitForResponse(response => response.url().endsWith("/api/scenario-builder") && response.request().method() === "POST")
  await builder.getByRole("button", { name: "Run", exact: true }).click()
  const { build } = await (await buildStarted).json()
  const sources = await (await page.request.get(`/api/documents/${build.request.documentSetId}`)).json()
  expect(sources.documentSet.documents.map((document: { name: string }) => document.name)).toEqual(["user-situation.txt"])
  await expect(builder.getByRole("button", { name: "Confirm scenario" })).toBeVisible({ timeout: 15_000 })
})

test("setup uses one modal scroll surface without nested or horizontal overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.getByRole("button", { name: /New Scenario/ }).click()
  const dialog = page.getByRole("dialog", { name: "New Scenario" })
  const form = dialog.locator(".document-builder-form")
  const files = form.locator(":scope > fieldset")
  const options = form.locator(":scope > [data-slot='field-group']")
  const fileBox = await files.boundingBox()
  const optionBox = await options.boundingBox()
  const pageBox = await dialog.boundingBox()
  expect(fileBox && optionBox && optionBox.y >= fileBox.y + fileBox.height).toBe(true)
  expect(pageBox && pageBox.width > 900).toBe(true)
  const typeField = dialog.getByLabel("Situation type · optional").locator("xpath=ancestor::*[@data-slot='field'][1]")
  const fastField = dialog.getByRole("switch", { name: "Fast processing" }).locator("xpath=ancestor::*[@data-slot='field'][1]")
  expect((await typeField.boundingBox())!.y).toBeCloseTo((await fastField.boundingBox())!.y, 0)
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  await expect(dialog.getByRole("button", { name: "Import finished scenario" })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath("scenario-setup-desktop.png"), fullPage: true })
  await page.setViewportSize({ width: 758, height: 713 })
  const body = dialog.locator(".document-scenario-body")
  const mediumOverflow = await body.evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth }))
  expect(mediumOverflow.scroll).toBeLessThanOrEqual(mediumOverflow.client + 1)
  expect(await body.evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true)
  expect(await dialog.evaluate(node => getComputedStyle(node).overflowY)).toBe("auto")
  await expect.poll(() => dialog.evaluate(node => parseFloat(getComputedStyle(node).maxHeight))).toBeLessThan(713)
  expect((await dialog.boundingBox())!.height).toBeLessThan(713)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("scenario-setup-medium.png"), fullPage: true })
  await dialog.getByLabel("Choose files").setInputFiles({
    name: `${"long-name-".repeat(18)}.md`, mimeType: "text/markdown", buffer: Buffer.from("# Long name"),
  })
  await dialog.getByRole("button", { name: "Add participant" }).click()
  await dialog.getByLabel("Name or role title").fill("A".repeat(80))
  expect(await body.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  expect(await dialog.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true)
  await page.setViewportSize({ width: 390, height: 844 })
  expect((await fastField.boundingBox())!.y).toBeGreaterThan((await typeField.boundingBox())!.y)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  const mobileOverflow = await body.evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth }))
  expect(mobileOverflow.scroll).toBeLessThanOrEqual(mobileOverflow.client + 1)
})

test("files wait for Run before extraction and fast processing reaches both stages", async ({ page }) => {
  const extractionModes: boolean[] = []
  let buildFastMode: boolean | undefined
  page.on("request", request => {
    if (request.method() === "POST" && /\/api\/documents\/[^/]+\/files\/[^/]+\/extract$/.test(request.url())) {
      extractionModes.push(request.postDataJSON().fastMode)
    }
    if (request.method() === "POST" && request.url().endsWith("/api/scenario-builder")) {
      buildFastMode = request.postDataJSON().fastMode
    }
  })
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.getByRole("button", { name: /New Scenario/ }).click()
  const dialog = page.getByRole("dialog", { name: "New Scenario" })
  await dialog.getByLabel("Choose files").setInputFiles({
    name: "proposal.md", mimeType: "text/markdown", buffer: Buffer.from("# Proposal\nCTO and Finance review the investment."),
  })
  await dialog.getByRole("switch", { name: "Fast processing" }).check()
  expect(extractionModes).toEqual([])
  expect(buildFastMode).toBeUndefined()
  await dialog.getByRole("button", { name: "Run", exact: true }).click()
  await expect(dialog.getByRole("button", { name: "Confirm scenario", exact: true })).toBeVisible({ timeout: 15_000 })
  expect(extractionModes).toEqual([true])
  expect(buildFastMode).toBe(true)
  const retained = await page.evaluate(async () => {
    const sessionUrl = "/src/ui/browser-storage/scenario-builder-session.ts"
    const attachmentsUrl = "/src/ui/shell/e2e-queries/attachments.ts"
    const { readDocumentScenarioSession } = await window.__simulaE2E!.import(sessionUrl) as typeof import("@/ui/browser-storage/scenario-builder-session")
    const { listDocumentAttachments, readAttachment } = await window.__simulaE2E!.import(attachmentsUrl) as typeof import("@/ui/shell/e2e-queries/attachments")
    const setId = readDocumentScenarioSession().documentSetId
    const stored = setId ? await listDocumentAttachments(setId) : []
    return { count: stored.length, text: stored[0] ? await (await readAttachment(stored[0])).text() : "" }
  })
  expect(retained).toEqual({ count: 1, text: "# Proposal\nCTO and Finance review the investment." })
  const oldSetId = await page.evaluate(() => JSON.parse(sessionStorage.getItem("simula.document-scenario") ?? "{}").documentSetId as string)
  await page.route(url => url.pathname === `/api/documents/${oldSetId}`, route => route.fulfill({ status: 404, json: { error: "Server restarted." } }))
  await page.evaluate(id => sessionStorage.setItem("simula.document-scenario", JSON.stringify({ documentSetId: id })), oldSetId)
  await page.reload()
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.getByRole("button", { name: /New Scenario/ }).click()
  const recoveredDialog = page.getByRole("dialog", { name: "New Scenario" })
  await recoveredDialog.getByRole("button", { name: "Run", exact: true }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("simula.document-scenario") ?? "{}").documentSetId as string))
    .not.toBe(oldSetId)
  await expect(recoveredDialog.getByRole("button", { name: "Confirm scenario", exact: true })).toBeVisible({ timeout: 15_000 })
  const interruptedBuild = await page.evaluate(async () => {
    const session = JSON.parse(sessionStorage.getItem("simula.document-scenario") ?? "{}") as { buildId: string }
    const moduleUrl = "/src/ui/shell/e2e-queries/artifacts.ts"
    const artifacts = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/shell/e2e-queries/artifacts")
    const saved = await artifacts.readBrowserArtifact<{ request: { documentSetId: string }; status: string }>("build", session.buildId)
    if (!saved) throw new Error("Expected saved scenario build")
    await artifacts.saveBrowserArtifact("build", session.buildId, saved.request.documentSetId, "failed", { ...saved, status: "failed" })
    return session.buildId
  })
  await page.route(url => url.pathname === `/api/scenario-builder/${interruptedBuild}`, route => route.fulfill({ status: 404, json: { error: "Server restarted." } }))
  await page.route(`**/api/scenario-builder/${interruptedBuild}/retry`, route => route.fulfill({ status: 404, json: { error: "Server restarted." } }))
  await page.reload()
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.getByRole("button", { name: /New Scenario/ }).click()
  await page.getByRole("dialog", { name: "New Scenario" }).getByRole("button", { name: "Retry", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "New Scenario" }).getByRole("button", { name: "Run", exact: true })).toBeVisible()
})

test("a failed extraction stops before scenario building", async ({ page }) => {
  let buildRequests = 0
  page.on("request", request => {
    if (request.method() === "POST" && request.url().endsWith("/api/scenario-builder")) buildRequests++
  })
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.getByRole("button", { name: /New Scenario/ }).click()
  const dialog = page.getByRole("dialog", { name: "New Scenario" })
  await dialog.getByLabel("Choose files").setInputFiles({
    name: "broken.pdf", mimeType: "application/pdf", buffer: Buffer.from("not a PDF"),
  })
  await dialog.getByRole("button", { name: "Run", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("The file could not be read", { timeout: 15_000 })
  expect(buildRequests).toBe(0)
})

test("closing the modal does not stop the queued scenario build", async ({ page }) => {
  let releaseFetch = () => {}
  const fetchGate = new Promise<void>(resolve => { releaseFetch = resolve })
  await page.route(url => /^\/api\/documents\/[^/]+$/.test(url.pathname), async route => {
    await fetchGate
    await route.continue()
  })
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.getByRole("button", { name: /New Scenario/ }).click()
  const dialog = page.getByRole("dialog", { name: "New Scenario" })
  await dialog.getByLabel("Choose files").setInputFiles({
    name: "brief.md", mimeType: "text/markdown", buffer: Buffer.from("# Brief\nCTO and Finance discuss the proposal."),
  })
  const buildStarted = page.waitForRequest(request => request.method() === "POST" && request.url().endsWith("/api/scenario-builder"))
  await dialog.getByRole("button", { name: "Run", exact: true }).click()
  await dialog.getByRole("button", { name: "Close", exact: true }).click()
  await expect(dialog).toBeHidden()
  releaseFetch()
  await buildStarted
})

test("uploads multiple documents, preserves cast constraints, confirms, and reopens on mobile", async ({ page }, testInfo) => {
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.getByRole("button", { name: /New Scenario/ }).click()
  const dialog = page.getByRole("dialog", { name: "New Scenario" })
  await dialog.getByLabel("Choose files").setInputFiles([
    { name: "budget.txt", mimeType: "text/plain", buffer: Buffer.from("The approved investment budget is 120 million won. The decision is whether to proceed.") },
    { name: "agenda.md", mimeType: "text/markdown", buffer: Buffer.from("# Review\nThe CTO and Finance must agree on an implementation date.") },
  ])
  await dialog.getByLabel("Situation to simulate · optional").fill("Review next quarter's investment.")
  await dialog.getByRole("button", { name: "Add participant" }).click()
  await dialog.getByLabel("Name or role title").first().fill("CTO")
  await dialog.getByLabel("Personality · optional").first().fill("Requires supporting evidence.")
  await dialog.getByRole("button", { name: "Add participant" }).click()
  await dialog.getByLabel("Name or role title").nth(1).fill("Finance")
  const generate = dialog.getByRole("button", { name: "Run", exact: true })
  await expect(generate).toBeEnabled({ timeout: 15_000 })
  const created = page.waitForResponse(response => response.url().endsWith("/api/scenario-builder") && response.request().method() === "POST")
  await generate.click()
  const { build } = await (await created).json()
  await expect(dialog.getByRole("button", { name: "Confirm scenario", exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(dialog.getByRole("heading", { name: "CTO", exact: true })).toBeVisible()
  await expect(dialog.getByText("Requires supporting evidence.", { exact: true })).toBeVisible()
  await expect(dialog.getByRole("heading", { name: "Source fact access" })).toBeVisible()
  await expect(dialog.getByText("Initially known by: Finance").first()).toBeVisible()
  let exactEvidenceRequests = 0
  page.on("request", request => { const url = new URL(request.url()); if (url.pathname.endsWith("/evidence") && url.searchParams.has("id")) exactEvidenceRequests++ })
  const source = dialog.getByRole("button", { name: /Evidence 1/ }).first()
  await expect(source).toBeVisible()
  expect(exactEvidenceRequests).toBe(0)
  await source.click()
  await expect(dialog.getByText(/The approved investment budget is 120 million won\.|The CTO and Finance must agree/)).toBeVisible()
  await expect(dialog.getByText(/Lines 1/)).toBeVisible()
  expect(exactEvidenceRequests).toBe(1)
  await dialog.getByText(/The approved investment budget is 120 million won\.|The CTO and Finance must agree/).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath("document-source-review.png"), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  await dialog.getByRole("button", { name: "Confirm scenario", exact: true }).click()
  await expect(dialog.getByText("Scenario confirmed", { exact: true })).toBeVisible()
  const saved = await (await page.request.get(`/api/scenario-builder/${build.id}`)).json()
  expect(saved.build.specification.participants.map((value: { name: string }) => value.name)).toEqual(["CTO", "Finance"])
  expect(saved.build.specification.sourceFacts[0].audience).toEqual({ kind: "participants", participantIds: ["participant-2"] })
  expect(saved.build.status).toBe("confirmed")
  await page.screenshot({ path: testInfo.outputPath("document-scenario-desktop.png"), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => {
    const box = await dialog.boundingBox()
    return !!box && box.x >= 0 && box.x + box.width <= 390
  }).toBe(true)
  await expect.poll(() => dialog.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("document-scenario-mobile.png"), fullPage: true })
  await dialog.getByRole("button", { name: "Close", exact: true }).click()
  await page.reload()
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.getByRole("button", { name: /New Scenario/ }).click()
  await expect(dialog.getByText("Scenario confirmed", { exact: true })).toBeVisible()
  await dialog.getByLabel("Max round", { exact: true }).fill("1")
  await dialog.getByLabel("Actions per type", { exact: true }).fill("1")
  await dialog.getByRole("button", { name: "Develop story", exact: true }).click()
  await expect(dialog.getByRole("button", { name: "Start simulation", exact: true })).toBeVisible({ timeout: 15_000 })
  const materialized = page.waitForResponse(response => /\/api\/worlds\/[^/]+\/run$/.test(response.url()) && response.request().method() === "POST")
  await dialog.getByRole("button", { name: "Start simulation", exact: true }).click()
  const { run } = await (await materialized).json()
  await expect(page.getByRole("dialog", { name: "Move to the Report page?" })).toBeVisible({ timeout: 15_000 })
  const final = await (await page.request.get(`/api/runs/${run.id}`)).json()
  expect(final.state.actors.map((actor: { name: string }) => actor.name)).toEqual(["CTO", "Finance"])
  expect(final.state.actors[0].personality).toBe("Requires supporting evidence.")
  expect(final.state.scenario.world.sourceScenarioId).toBe(build.id)
  await expect.poll(() => page.evaluate(async runId => {
    const path = "/src/ui/shell/e2e-queries/runs.ts"
    const { readBrowserRun } = await window.__simulaE2E!.import(path) as typeof import("@/ui/shell/e2e-queries/runs")
    return (await readBrowserRun(runId))?.events.some(event => event.type === "model.metrics" && event.metrics.role === "storyBuilder")
  }, run.id)).toBe(true)
})

test("reviewed source excerpts remain readable after newer materials are added", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.getByRole("button", { name: /New Scenario/ }).click()
  const dialog = page.getByRole("dialog", { name: "New Scenario" })
  await dialog.getByLabel("Choose files").setInputFiles({ name: "budget.txt", mimeType: "text/plain", buffer: Buffer.from("The investment budget is 120 million won.") })
  await dialog.getByLabel("Situation type · optional").click()
  await page.getByRole("option", { name: "Meeting" }).click()
  const generate = dialog.getByRole("button", { name: "Run", exact: true })
  await expect(generate).toBeEnabled({ timeout: 15_000 })
  const created = page.waitForResponse(response => response.url().endsWith("/api/scenario-builder") && response.request().method() === "POST")
  await generate.click()
  const request = (await created).request().postDataJSON() as { documentSetId: string; situation: string; participants: unknown[] }
  expect(request).toMatchObject({ situation: "meeting", participants: [] })
  const { documentSetId } = request
  await expect(dialog.getByRole("heading", { name: "Technical lead", exact: true })).toBeVisible({ timeout: 15_000 })
  await expect(dialog.getByRole("heading", { name: "Finance representative", exact: true })).toBeVisible()
  await expect(dialog.getByRole("button", { name: /Evidence 1/ }).first()).toBeVisible({ timeout: 15_000 })
  expect((await page.request.post(`/api/documents/${documentSetId}/files`, { multipart: { file: { name: "later.txt", mimeType: "text/plain", buffer: Buffer.from("Later source") } } })).status()).toBe(201)
  await dialog.getByRole("button", { name: /Evidence 1/ }).first().click()
  await expect(dialog.getByText("The investment budget is 120 million won.", { exact: true })).toBeVisible()
  await expect(dialog.getByText("Later source", { exact: true })).toHaveCount(0)
})

test("a failed file upload stays selectable for retry", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.getByRole("button", { name: /New Scenario/ }).click()
  const dialog = page.getByRole("dialog", { name: "New Scenario" })
  await dialog.getByLabel("Choose files").setInputFiles({ name: "retry.txt", mimeType: "text/plain", buffer: Buffer.from("Review the budget.") })
  await page.route("**/api/documents/*/files", route => route.fulfill({ status: 503, contentType: "application/json", body: '{}' }))
  await dialog.getByRole("button", { name: "Run", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("The request failed")
  await expect(dialog.getByText("retry.txt", { exact: true })).toBeVisible()
  await page.unroute("**/api/documents/*/files")
  await dialog.getByRole("button", { name: "Run", exact: true }).click()
  await expect(dialog.getByRole("button", { name: "Confirm scenario", exact: true })).toBeVisible({ timeout: 15_000 })
})

test("selected task streams named fields and replaces a retried draft", async ({ page }, testInfo) => {
  let record: Record<string, unknown> | undefined
  let canceled = false
  const executionId = "55555555-5555-4555-8555-555555555555"
  await page.route(url => url.pathname.startsWith("/api/scenario-builder"), async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === "/api/scenario-builder" && request.method() === "POST") {
      record = { id: request.headers()["idempotency-key"], request: request.postDataJSON(), status: "running", createdAt: new Date().toISOString() }
      return route.fulfill({ status: 202, json: { build: record } })
    }
    if (url.pathname.endsWith("/events")) {
      const task = { type: "task", taskId: "situation", kind: "situation", attempt: 1, status: "running" }
      const events: unknown[] = [{ type: "snapshot", executionId, tasks: [task] }]
      if (url.searchParams.get("task") === "situation") {
        events.push({ type: "event", executionId, event: { type: "draft", taskId: "situation", attempt: 1, sequence: 1, fields: [{ key: "summary", text: "Superseded draft" }] } })
        events.push({ type: "event", executionId, event: { ...task, attempt: 2 } })
        const draft = { type: "event", executionId, event: { type: "draft", taskId: "situation", attempt: 2, sequence: 1, fields: [{ key: "summary", text: "The current investment review is being written live." }] } }
        events.push(draft, draft)
      }
      return route.fulfill({ contentType: "text/event-stream", body: events.map(event => {
        const type = typeof event === "object" && event && "type" in event ? event.type : "event"
        return `event: ${type}
data: ${JSON.stringify(event)}

`
      }).join("") })
    }
    if (url.pathname.endsWith("/cancel")) { canceled = true; return route.fulfill({ json: { status: "canceling" } }) }
    return route.fulfill({ json: { build: { ...record, status: canceled ? "canceled" : "running" } } })
  })
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.getByRole("button", { name: /New Scenario/ }).click()
  const dialog = page.getByRole("dialog", { name: "New Scenario" })
  await dialog.getByLabel("Choose files").setInputFiles({ name: "live.txt", mimeType: "text/plain", buffer: Buffer.from("Review the investment budget.") })
  const generate = dialog.getByRole("button", { name: "Run", exact: true })
  await expect(generate).toBeEnabled()
  await generate.click()
  await dialog.locator(".document-builder-task").first().click()
  await expect(dialog.getByText("The current investment review is being written live.", { exact: true })).toHaveCount(1)
  await expect(dialog.getByText("Superseded draft", { exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath("document-scenario-live.png"), fullPage: true })
  await dialog.getByRole("button", { name: "Cancel generation", exact: true }).click()
  await expect(dialog.getByText("Canceled", { exact: true })).toBeVisible()
})
