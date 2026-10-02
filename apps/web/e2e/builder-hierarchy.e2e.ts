/**
 * Purpose: Verify generation targets contain their own steps, scoped content, and keyboard return paths.
 * Pattern: Browser workflow tests with fixed generation progress and artifacts.
 * Usage: bunx --no-install playwright test apps/web/e2e/builder-hierarchy.e2e.ts --project=chromium
 * Related: src/ui/components/scenario-builder/builder-activity.tsx, src/ui/components/scenario-builder/builder-task-output.tsx
 */
import { expect, test, type Page } from "./fixtures"
import type { DocumentSet } from "@/shared/documents"
import type { GenerationTaskView } from "@/ui/models/generation/progress"

const EXECUTION_ID = "55555555-5555-4555-8555-555555555555"
const TECHNICAL_LEAD = "기술 전략과 신제품 개발을 담당하는 총괄 책임자 · Technical strategy and product development lead"
const FINANCE_LEAD = "재무 담당자 · Finance representative"

async function startBuilder(page: Page, language: "en" | "ko") {
  await page.emulateMedia({ reducedMotion: "reduce" })
  const { settings } = await (await page.request.get("/api/settings")).json()
  settings.providers.openai.apiKey = "unit-test-api-key"
  settings.roles.storyBuilder.provider = "openai"
  await page.request.put("/api/settings", { data: { settings } })
  await page.addInitScript(locale => {
    localStorage.setItem("simula.language", locale)
    const NativeSource = window.EventSource
    let active = 0
    window.EventSource = class extends NativeSource {
      private counted = false
      constructor(url: string | URL, options?: EventSourceInit) {
        super(url, options)
        if (String(url).includes("/scenario-builder/") && String(url).includes("/events")) {
          this.counted = true
          document.documentElement.dataset.builderStreams = String(++active)
        }
      }
      override close() {
        if (this.counted) {
          this.counted = false
          document.documentElement.dataset.builderStreams = String(--active)
        }
        super.close()
      }
    }
  }, language)
  let record: Record<string, unknown> = {}
  let tasks: GenerationTaskView[] = []
  let executionId = EXECUTION_ID
  const acceptedRequests: string[] = []
  const task = (taskId: string, kind: GenerationTaskView["kind"], scope?: GenerationTaskView["scope"],
    status: GenerationTaskView["status"] = "completed"): GenerationTaskView => ({ type: "task", taskId, kind, scope, attempt: 1, status })
  await page.route(url => url.pathname.startsWith("/api/scenario-builder"), async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === "/api/scenario-builder" && request.method() === "POST") {
      const buildRequest = request.postDataJSON() as { documentSetId: string }
      const { documentSet } = await (await page.request.get(`/api/documents/${buildRequest.documentSetId}`)).json() as { documentSet: DocumentSet }
      tasks = documentSet.documents.flatMap(document => [
        task(`evidence-${document.id}-0-claim-1`, "evidence", { kind: "document", id: document.id }),
        task(`evidence-${document.id}-0-summary`, "evidence", { kind: "document", id: document.id }),
      ])
      tasks.push(task("sources-digest-0-0-summary", "digest"), task("situation-title", "situation"),
        task("roster-count", "roster"), task("roster-name-1", "roster"), task("roster-name-2", "roster"),
        task("participant-1-personality", "participant", { kind: "participant", name: TECHNICAL_LEAD }),
        task("participant-1-authority", "participant", { kind: "participant", name: TECHNICAL_LEAD }),
        task("participant-1-goal", "participant", { kind: "participant", name: TECHNICAL_LEAD }, "running"),
        task("participant-2-personality", "participant", { kind: "participant", name: FINANCE_LEAD }, "waiting"))
      record = { id: request.headers()["idempotency-key"], request: request.postDataJSON(), status: "running", createdAt: new Date().toISOString() }
      return route.fulfill({ status: 202, json: { build: record } })
    }
    if (url.pathname.endsWith("/task")) {
      const id = url.searchParams.get("id") ?? ""
      acceptedRequests.push(id)
      const value = id === "roster-count" ? 2 : id === "participant-1-personality"
        ? executionId === EXECUTION_ID ? "The lead compares technical risks before deciding." : "The restarted execution has a newly accepted personality."
        : `Accepted result for ${id}`
      return route.fulfill({ json: { task: { value } } })
    }
    if (url.pathname.endsWith("/events")) {
      const events: unknown[] = [{ type: "snapshot", executionId, tasks }]
      if (url.searchParams.get("task") === "participant-1-goal") {
        const base = tasks.find(value => value.taskId === "participant-1-goal")
        events.push({ type: "event", executionId, event: { type: "draft", taskId: "participant-1-goal", attempt: 1, sequence: 1, fields: [{ key: "goal", text: "Superseded goal draft" }] } },
          { type: "event", executionId, event: { ...base, attempt: 2, status: "retrying" } },
          { type: "event", executionId, event: { type: "draft", taskId: "participant-1-goal", attempt: 2, sequence: 1, fields: [{ key: "goal", text: "Secure approval for the next product milestone." }] } })
      }
      return route.fulfill({ contentType: "text/event-stream", body: events.map(event => {
        const type = typeof event === "object" && event && "type" in event ? event.type : "event"
        return `event: ${type}\ndata: ${JSON.stringify(event)}\n\n`
      }).join("") })
    }
    return route.fulfill({ json: { build: record } })
  })
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.getByRole("button", { name: language === "en" ? /New Scenario/ : /새 시나리오/ }).click()
  const input = page.getByRole("main")
  await input.getByLabel(language === "en" ? "Choose files" : "파일 선택").setInputFiles([
    { name: "투자 제안과 기술 검토 · investment-proposal.md", mimeType: "text/markdown", buffer: Buffer.from("# Proposal\nReview the investment and technology risks.") },
    { name: "예산과 승인 조건 · budget-conditions.txt", mimeType: "text/plain", buffer: Buffer.from("The approved investment budget is 120 million won.") },
  ])
  await input.getByRole("button", { name: language === "en" ? "Run" : "실행", exact: true }).click()
  await expect(page).toHaveURL("/document-analysis")
  const activity = page.locator(".builder-generation")
  await expect(activity.getByRole("tab", { name: language === "en" ? "Build participants" : "인물 구성", exact: true })).toHaveAttribute("data-state", "active")
  await expect(activity.getByRole("button", { name: TECHNICAL_LEAD, exact: true })).toBeVisible()
  return { activity, acceptedRequests, restartExecution: () => { executionId = "66666666-6666-4666-8666-666666666666" } }
}

test("stage, person, and step retain their identities and dispose only selected content", async ({ page }, testInfo) => {
  const { activity, acceptedRequests } = await startBuilder(page, "en")
  const technical = activity.getByRole("button", { name: TECHNICAL_LEAD, exact: true })
  await expect(technical).toHaveCount(1)
  await expect(activity.getByRole("button", { name: FINANCE_LEAD, exact: true })).toHaveCount(1)
  await expect(activity.getByRole("button", { name: "Personality", exact: true })).toHaveCount(0)
  expect(acceptedRequests).toEqual([])
  await expect(page.locator("html")).toHaveAttribute("data-builder-streams", "1")
  await page.screenshot({ path: testInfo.outputPath("participant-targets.png"), fullPage: true })
  await technical.click()
  const steps = activity.getByRole("region", { name: "Steps", exact: true })
  await expect(steps.getByRole("button")).toHaveCount(3)
  await expect(activity.getByRole("navigation", { name: "Generation path" }).locator("li")).toHaveCount(2)
  expect(acceptedRequests).toEqual([])
  await steps.getByRole("button", { name: "Personality", exact: true }).click()
  await expect(activity.getByText("The lead compares technical risks before deciding.", { exact: true })).toBeVisible()
  expect(acceptedRequests).toEqual(["participant-1-personality"])
  await expect(activity.getByRole("navigation", { name: "Generation path" }).locator("li")).toHaveCount(3)
  await expect(activity.getByRole("heading", { name: "Personality", exact: true })).toBeFocused()
  await activity.getByRole("button", { name: "Back to steps", exact: true }).click()
  await steps.getByRole("button", { name: "Personality", exact: true }).click()
  await steps.getByRole("button", { name: "Immediate goal", exact: true }).click()
  await expect(activity.getByText("Secure approval for the next product milestone.", { exact: true })).toHaveCount(1)
  await expect(activity.getByText("Superseded goal draft", { exact: true })).toHaveCount(0)
  await expect(steps.getByRole("button")).toHaveCount(3)
  expect(acceptedRequests).toEqual(["participant-1-personality"])
  await expect(page.locator("html")).toHaveAttribute("data-builder-streams", "2")
  await page.screenshot({ path: testInfo.outputPath("participant-step-live.png"), fullPage: true })
  await page.keyboard.press("Escape")
  await expect(steps.getByRole("button", { name: "Immediate goal", exact: true })).toBeFocused()
  await expect(page.locator("html")).toHaveAttribute("data-builder-streams", "1")
  await page.keyboard.press("Escape")
  await expect(technical).toBeFocused()
  await activity.getByRole("button", { name: "Participant selection", exact: true }).click()
  await activity.getByRole("button", { name: "Choose participant count", exact: true }).click()
  await expect(activity.getByText("This step is complete. Its choice is included in the scenario review.", { exact: true })).toBeVisible()
  await activity.getByRole("button", { name: "Build participants", exact: true }).click()
  await expect(activity.getByRole("button", { name: "Participant selection", exact: true })).toBeFocused()
  await activity.getByRole("tab", { name: "Read materials", exact: true }).click()
  await expect(activity.locator("[data-builder-target]")).toHaveCount(3)
  const source = activity.getByRole("button", { name: "투자 제안과 기술 검토 · investment-proposal.md", exact: true })
  await source.click()
  await expect(steps.getByRole("button")).toHaveCount(2)
  await steps.getByRole("button", { name: "Evidence group 1: summary", exact: true }).click()
  await expect(activity.getByText(/^Accepted result for evidence-.*-summary$/)).toBeVisible()
  expect(acceptedRequests).toHaveLength(3)
  await expect(activity.getByText("Secure approval for the next product milestone.", { exact: true })).toHaveCount(0)
  await activity.getByRole("button", { name: "Read materials", exact: true }).click()
  await expect(source).toBeFocused()
  await page.getByRole("button", { name: "Home", exact: true }).click()
  await expect(activity).toHaveCount(0)
  await expect(page.locator("html")).toHaveAttribute("data-builder-streams", "0")
})

test("Korean hierarchy and long target names fit desktop and compact frames", async ({ page }, testInfo) => {
  const { activity } = await startBuilder(page, "ko")
  await activity.getByRole("button", { name: TECHNICAL_LEAD, exact: true }).click()
  await activity.getByRole("button", { name: "의사결정 범위", exact: true }).click()
  for (const width of [1920, 1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(activity.getByRole("navigation", { name: "생성 경로" }).locator("li")).toHaveCount(3)
    const bounds = await page.locator(".workspace-frame").boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds?.x).toBeCloseTo(width * 0.1, 0)
    expect(bounds?.width).toBeCloseTo(width * 0.8, 0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`participant-depth-${width}.png`), fullPage: true })
  }
  await activity.getByRole("button", { name: "세부 단계 목록", exact: true }).click()
  await expect(activity.getByRole("button", { name: "의사결정 범위", exact: true })).toBeFocused()
  await activity.getByRole("button", { name: "생성 대상 목록", exact: true }).click()
  await expect(activity.getByRole("button", { name: TECHNICAL_LEAD, exact: true })).toBeFocused()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.locator("body").evaluate(element => { element.style.zoom = "2" })
  await activity.getByRole("button", { name: TECHNICAL_LEAD, exact: true }).click()
  await activity.getByRole("button", { name: "성격", exact: true }).click()
  await expect(activity.getByRole("heading", { name: "성격", exact: true })).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("participant-depth-200percent.png"), fullPage: true })
})

test("a reconnected execution cannot reuse another execution's accepted step", async ({ page }) => {
  const { activity, acceptedRequests, restartExecution } = await startBuilder(page, "en")
  await activity.getByRole("button", { name: TECHNICAL_LEAD, exact: true }).click()
  await activity.getByRole("button", { name: "Personality", exact: true }).click()
  await expect(activity.getByText("The lead compares technical risks before deciding.", { exact: true })).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(page.locator("html")).toHaveAttribute("data-builder-streams", "0")
  restartExecution()
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  await expect(activity.getByText("The restarted execution has a newly accepted personality.", { exact: true })).toBeVisible()
  await expect(activity.getByText("The lead compares technical risks before deciding.", { exact: true })).toHaveCount(0)
  expect(acceptedRequests).toEqual(["participant-1-personality", "participant-1-personality"])
  await expect(page.locator("html")).toHaveAttribute("data-builder-streams", "1")
  await expect(activity.getByRole("navigation", { name: "Generation path" }).locator("li")).toHaveCount(3)
})
