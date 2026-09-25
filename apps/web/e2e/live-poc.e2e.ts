/**
 * Purpose: Qualify the small document-to-report browser journey using actual local Ornith.
 * Pattern: Browser workflow acceptance test.
 * Usage: bunx playwright test -c playwright.live.config.ts
 * Related: playwright.live.config.ts, scripts/start-live-poc-server.ts
 */
import { resolve } from "node:path"
import { expect, test, type APIRequestContext } from "./fixtures"

const inputFile = resolve(import.meta.dirname, "../../../sample-input-items/notes.txt")
let confirmedScenarioId: string
let sessionCookie = ""

test.describe.configure({ mode: "serial" })

async function terminalStatus(request: APIRequestContext, url: string, statuses: string[]) {
  await expect.poll(async () => {
    const response = await request.get(url)
    return response.ok() && statuses.includes((await response.json()).build?.status)
  }, { timeout: 300_000, intervals: [1000, 2000, 3000] }).toBe(true)
  return (await (await request.get(url)).json()).build
}

test("Ornith completes a tiny document scenario, two actor rounds and an analysis", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  await page.goto("/")
  const { settings } = await (await page.request.get("/api/settings/defaults")).json()
  settings.concurrency = 1
  settings.providers.lmstudio = { baseUrl: "http://127.0.0.1:1234/v1", apiKey: "lm-studio", streamUsage: true }
  for (const role of Object.keys(settings.roles)) settings.roles[role] = { provider: "lmstudio", model: "ornith-1.5-35b-a3b",
    temperature: 0, maxTokens: 4096, timeoutSeconds: 120, extraBody: { reasoning_effort: "none" } }
  expect((await page.request.put("/api/settings", { data: { settings } })).ok()).toBe(true)
  await page.getByRole("button", { name: /New Scenario/ }).click()
  const dialog = page.getByRole("main", { name: "New Scenario" })
  await dialog.getByLabel("Choose files").setInputFiles(inputFile)
  await dialog.getByRole("button", { name: "Add participant" }).click()
  await dialog.getByLabel("Name or role title").first().fill("CTO")
  await dialog.getByRole("button", { name: "Add participant" }).click()
  await dialog.getByLabel("Name or role title").nth(1).fill("Finance")
  const buildStarted = page.waitForResponse(response => response.url().endsWith("/api/scenario-builder") && response.request().method() === "POST")
  await dialog.getByRole("button", { name: "Run", exact: true }).click()
  const { build } = await (await buildStarted).json()
  const reviewed = await terminalStatus(page.request, `/api/scenario-builder/${build.id}`, ["review", "blocked", "failed"])
  expect(reviewed.status, JSON.stringify(reviewed.specification?.issues ?? reviewed.issue)).toBe("review")
  await dialog.getByRole("button", { name: "Confirm scenario", exact: true }).click()
  await expect(dialog.getByText("Scenario confirmed", { exact: true })).toBeVisible()
  confirmedScenarioId = build.id
  await dialog.getByLabel("Max round", { exact: true }).fill("2")
  await dialog.getByLabel("Actions per type", { exact: true }).fill("1")
  const worldStarted = page.waitForResponse(response => response.url().endsWith("/api/worlds") && response.request().method() === "POST")
  await dialog.getByRole("button", { name: "Develop story", exact: true }).click()
  const { world } = await (await worldStarted).json()
  await expect.poll(async () => {
    const record = (await (await page.request.get(`/api/worlds/${world.id}`)).json()).world
    return ["ready", "failed", "canceled"].includes(record.status)
  }, { timeout: 300_000, intervals: [1000, 2000, 3000] }).toBe(true)
  const prepared = (await (await page.request.get(`/api/worlds/${world.id}`)).json()).world
  expect(prepared.status, prepared.issue).toBe("ready")
  await expect(dialog.getByRole("button", { name: "Start simulation", exact: true })).toBeVisible({ timeout: 300_000 })
  await dialog.getByRole("switch", { name: "Auto continue", exact: true }).check()
  const runStarted = page.waitForResponse(response => /\/api\/worlds\/[^/]+\/run$/.test(response.url()) && response.request().method() === "POST")
  await dialog.getByRole("button", { name: "Start simulation", exact: true }).click()
  const { run } = await (await runStarted).json()
  await expect.poll(async () => {
    const record = (await (await page.request.get(`/api/runs/${run.id}`)).json()).run
    return ["completed", "failed", "canceled"].includes(record.status)
  }, { timeout: 300_000, intervals: [1000, 2000, 3000] }).toBe(true)
  const runStatus = (await (await page.request.get(`/api/runs/${run.id}`)).json()).run
  expect(runStatus.status, runStatus.error).toBe("completed")
  await expect(page.getByRole("dialog", { name: "Move to the Report page?" })).toBeVisible({ timeout: 300_000 })
  const runDetail = await (await page.request.get(`/api/runs/${run.id}`)).json()
  expect(runDetail.run.status).toBe("completed")
  expect(runDetail.state.roundDigests.length).toBeGreaterThanOrEqual(2)
  expect(runDetail.state.reportCommentary?.status).toBe("ready")
  await page.getByRole("button", { name: "Open Report" }).click()
  const analysisStarted = page.waitForResponse(response => response.url().endsWith("/api/analysis") && response.request().method() === "POST")
  await page.getByRole("button", { name: "Generate analysis", exact: true }).click()
  const { analysis } = await (await analysisStarted).json()
  await expect.poll(async () => {
    const record = (await (await page.request.get(`/api/analysis/${analysis.id}`)).json()).analysis
    return ["ready", "partial", "failed"].includes(record.status)
  }, { timeout: 300_000, intervals: [1000, 2000, 3000] }).toBe(true)
  const final = (await (await page.request.get(`/api/analysis/${analysis.id}`)).json()).analysis
  expect(final.status, JSON.stringify(final.issue ?? final.report?.unavailableInputs)).toBe("ready")
  expect(final.report.sections.length).toBeGreaterThan(0)
  sessionCookie = (await page.context().cookies()).find(cookie => cookie.name === "simula-session")?.value ?? ""
})

test("Ornith reuses one scenario for two isolated worlds and a combined analysis", async ({ browser }) => {
  test.setTimeout(1_800_000)
  const context = await browser.newContext({ ignoreHTTPSErrors: true, baseURL: "https://127.0.0.1:4019" })
  await context.addCookies([{ name: "simula-session", value: sessionCookie, url: "https://127.0.0.1:4019" }])
  const request = context.request
  const batchId = crypto.randomUUID()
  const created = await request.post("/api/multiverse", {
    headers: { "Idempotency-Key": batchId },
    data: { scenarioId: confirmedScenarioId, controls: { maxRound: 1, actionsPerType: 1, fastMode: false },
      worldCount: 2, autoContinue: true, maxDurationMinutes: 30 },
  })
  expect(created.status(), await created.text()).toBe(202)
  const readBatch = async () => (await (await request.get(`/api/multiverse/${batchId}`)).json()).batch
  await expect.poll(async () => (await readBatch()).status, { timeout: 1_200_000, intervals: [2000, 3000] })
    .toMatch(/^(completed|partial|interrupted|canceled)$/)
  const batch = await readBatch()
  expect(batch.status, JSON.stringify(batch.worlds.map((world: { status: string; issue?: string }) => [world.status, world.issue]))).toBe("completed")
  expect(batch.worlds).toHaveLength(2)
  expect(new Set(batch.worlds.map((world: { runId: string }) => world.runId)).size).toBe(2)

  const analysisId = crypto.randomUUID()
  const response = await request.post("/api/analysis", {
    headers: { "Idempotency-Key": analysisId }, data: { subject: { kind: "batch", id: batchId } },
  })
  expect(response.status(), await response.text()).toBe(202)
  await expect.poll(async () => (await (await request.get(`/api/analysis/${analysisId}`)).json()).analysis.status,
    { timeout: 600_000, intervals: [2000, 3000] }).toMatch(/^(ready|partial|failed)$/)
  const { analysis } = await (await request.get(`/api/analysis/${analysisId}`)).json()
  expect(analysis.status, JSON.stringify(analysis.report?.sections.map((section: { id: string; status: string }) => [section.id, section.status]))).toBe("ready")
  expect(analysis.report.coverage).toMatchObject({ requested: 2, completed: 2, analyzed: 2 })
  const trajectories = analysis.report.trajectories
  expect(trajectories.categories.reduce((count: number, category: { worldIds: string[] }) => count + category.worldIds.length, trajectories.unclassifiedWorldIds.length)).toBe(2)
})
