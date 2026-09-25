/**
 * Purpose: Verify primary browser workflows across landing, simulation, and report pages.
 * Pattern: End-to-end contract test.
 * Usage: Executed by Playwright through bun run test:e2e.
 * Related: src/ui/shell/App.tsx, src/backend/api/routes.ts
 */
import { expect, test, type Page } from "./fixtures"

test("runs the engine flow from settings to report", async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  await setUnitTestApiKeys(page)
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Start a simulation" })).toBeVisible()
  await page.getByRole("button", { name: "Settings" }).click()
  await expect(page.getByRole("dialog", { name: "LLM settings" })).toBeVisible()
  await page.keyboard.press("Escape")

  await expect(page.getByRole("button", { name: /New Scenario/ })).toBeVisible()
  const uploadChooser = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: /Import finished scenario/ }).click()
  const chooser = await uploadChooser
  await chooser.setFiles({
    name: "uploaded-scenario.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("A product team debates a risky release with impact $x^2$."),
  })
  const scenarioPreview = page.getByRole("dialog", { name: "Scenario Preview" })
  await expect(scenarioPreview).toBeVisible()
  await expect(page.getByText(/risky release/)).toBeVisible()
  await expect(scenarioPreview.locator(".katex").first()).toBeVisible()
  await page.getByLabel("Cast size").fill("3")
  await expect(page.getByLabel("Max round")).toHaveValue("8")
  await page.getByLabel("Max round").fill("3")
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible()
  await page.getByRole("switch", { name: "Auto continue" }).check()
  await expect(page.getByRole("switch", { name: "Autonomous progression", exact: true })).not.toBeChecked()
  const startRequest = page.waitForRequest(request => request.url().endsWith("/api/runs") && request.method() === "POST")
  await page.getByRole("button", { name: "Start", exact: true }).click()
  expect((await startRequest).postDataJSON().scenario.controls.autonomousProgress ?? false).toBe(false)
  await expect.poll(() => new URL(page.url()).pathname).toBe("/simulation")

  await expect(page.getByRole("button", { name: "Open menu" })).toHaveCount(0)

  await expect(page.getByRole("dialog", { name: "Move to the Report page?" })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole("heading", { name: "Report", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Open Report" }).click()
  await expect(page.getByRole("button", { name: "Relationships", exact: true })).toBeVisible()
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/reports\/[^/]+$/)
  await page.reload()
  await expect(page.getByRole("button", { name: "Relationships", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Analysis board", exact: true })).toBeVisible()
  await expect(page.getByPlaceholder("Find actor")).toHaveCount(0)
  expect(await page.locator("details").count()).toBe(0)
  await page.screenshot({ path: testInfo.outputPath("report-commentary.png"), fullPage: true })
  const response = page.waitForResponse(response => response.url().endsWith("/api/analysis") && response.request().method() === "POST")
  await page.getByRole("button", { name: "Generate analysis", exact: true }).click()
  const generated = await response
  expect(generated.status()).toBe(202)
  const { analysis } = await generated.json()
  await expect.poll(async () => (await (await page.request.get(`/api/analysis/${analysis.id}`)).json()).analysis.status).toBe("ready")
  await expect(page.getByRole("heading", { name: "Overall conclusion", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Home" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Relationships", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await expect(page.getByRole("menuitem", { name: "Export Markdown" })).toBeVisible()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Relationships", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Overall conclusion", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Play replay" }).click()
  await expect(page.getByLabel("Replay timeline")).toBeEnabled()
  await page.getByRole("button", { name: "Close details" }).click()
  await page.getByRole("button", { name: "Conversations", exact: true }).click()
  await expect(page.getByRole("region", { name: "Round board" })).toBeVisible()
  await page.getByRole("button", { name: "Close details" }).click()
  await expect(page.getByRole("region", { name: "LLM metrics" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Performance", exact: true })).toHaveCount(0)
})

test("supports scenario builder, samples, history, and Korean locale", async ({ page }) => {
  await setUnitTestApiKeys(page)

  await page.addInitScript(() => {
    localStorage.setItem("simula.language", "ko")
  })
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "시뮬레이션 시작하기" })).toBeVisible()

  await page.getByRole("button", { name: /새 시나리오/ }).click()
  const builder = page.getByRole("dialog", { name: "새 시나리오" })
  await expect(builder.getByText("참고 파일 · 선택", { exact: true })).toBeVisible()
  await builder.getByLabel("시뮬레이션할 상황 · 선택").fill("시장이 재난 대피 결정을 미루는 상황")
  await builder.getByRole("button", { name: "실행", exact: true }).click()
  await expect(builder.getByRole("button", { name: "시나리오 확정", exact: true })).toBeVisible({ timeout: 15_000 })
  await builder.getByRole("button", { name: "닫기", exact: true }).click()

  await page.getByRole("button", { name: /예시 시나리오 실행/ }).click()
  await expect(page.getByRole("dialog", { name: "예시 시나리오" })).toBeVisible()
  await page.getByRole("button", { name: "불러오기" }).first().click()
  const samplePreview = page.getByRole("dialog", { name: "시나리오 미리보기" })
  await expect(samplePreview).toBeVisible()
  await expect(samplePreview.getByText(/\.md/).first()).toBeVisible()
  await expect(samplePreview.getByLabel("최대 라운드")).toBeVisible()
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: /실행 내역 보기/ }).click()
  await expect(page.getByRole("dialog", { name: "실행 내역" })).toBeVisible()
})

async function setUnitTestApiKeys(page: Page) {
  const settingsResponse = await page.request.get("/api/settings")
  const { settings } = (await settingsResponse.json()) as {
    settings: { providers: { openai: { apiKey?: string } } }
  }
  settings.providers.openai.apiKey = "unit-test-api-key"
  await page.request.put("/api/settings", { data: { settings } })
}

test("autonomous progression reaches the backend and stops on a zero decision before max round", async ({ page }) => {
  await setUnitTestApiKeys(page)
  await page.goto("/")
  const chooserPromise = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: /Import finished scenario/ }).click()
  await (await chooserPromise).setFiles({ name: "autonomous.md", mimeType: "text/markdown", buffer: Buffer.from("A team decides a release date.") })
  await page.getByLabel("Cast size").fill("2")
  await page.getByLabel("Max round").fill("3")
  await page.getByRole("switch", { name: "Autonomous progression", exact: true }).check()
  const createdPromise = page.waitForResponse(response => response.url().endsWith("/api/runs") && response.request().method() === "POST")
  await page.getByRole("button", { name: "Start", exact: true }).click()
  const { run } = await (await createdPromise).json()
  await expect(page.getByRole("dialog", { name: "Move to the Report page?" })).toBeVisible({ timeout: 20_000 })
  const detail = await (await page.request.get(`/api/runs/${run.id}`)).json()
  expect(detail.state.scenario.controls.autonomousProgress).toBe(true)
  expect(detail.state.scenario.controls.maxRound).toBe(3)
  expect(detail.state.roundDigests).toHaveLength(1)
  expect(detail.state.roleTraces.find((trace: { role: string }) => trace.role === "coordinator").progressDecision).toBe("0")
})
