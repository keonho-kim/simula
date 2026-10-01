/**
 * Purpose: Verify encrypted browser settings unlock and transient server resynchronization.
 * Pattern: Browser credential workflow test.
 * Usage: bun run test:e2e apps/web/e2e/credential-settings.e2e.ts
 * Related: src/ui/pages/credential-gate.tsx, src/ui/browser-storage/database/credential-vault.ts
 */
import { expect, test } from "./fixtures"
import type { WebSocketRoute } from "@playwright/test"

test("saved model settings require an unlock after refresh without plaintext SQLite secrets", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  await page.goto("/")
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  const settings = page.getByRole("main", { name: "LLM settings" })
  await settings.locator('input[type="password"]').first().fill("unit-test-api-key")
  await settings.getByRole("textbox", { name: "Credentials passphrase" }).fill("long local passphrase")
  await settings.getByRole("button", { name: "Save settings" }).click()
  await expect(settings).toBeHidden()
  const raw = await page.evaluate(async () => {
    const moduleUrl = "/src/ui/browser-storage/database/connection.ts"
    const { browserDatabase } = await window.__simulaE2E!.import(moduleUrl) as typeof import("@/ui/browser-storage/database/connection")
    return (await (await browserDatabase()).query<{ value_json: string }>({ sql: "SELECT value_json FROM settings WHERE id = 1" }))[0]?.value_json
  })
  expect(raw).not.toContain("unit-test-api-key")
  await page.reload()
  await page.waitForFunction(() => Boolean(window.__simulaE2E))
  await expect(page.getByRole("heading", { name: "Unlock credentials" })).toBeVisible()
  await page.getByRole("textbox", { name: "Credentials passphrase" }).fill("wrong passphrase")
  await page.getByRole("button", { name: "Unlock credentials" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "Check the passphrase" })).toBeVisible()
  let failedSyncs = 0
  await page.route("**/api/settings", route => {
    if (route.request().method() === "PUT" && failedSyncs++ === 0) {
      return route.fulfill({ status: 503, body: "Model settings are temporarily unavailable." })
    }
    return route.continue()
  })
  await page.getByRole("textbox", { name: "Credentials passphrase" }).fill("long local passphrase")
  await page.getByRole("button", { name: "Unlock credentials" }).click()
  await expect(page.getByRole("heading", { name: "Unlock credentials" })).toBeVisible()
  await expect(page.getByRole("alert").filter({ hasText: "Check the connection and retry" })).toBeVisible()
  await page.getByRole("button", { name: "Unlock credentials" }).click()
  await expect(page.getByRole("heading", { name: "Explore what could happen." })).toBeVisible()
  const { settings: current } = await (await page.request.get("/api/settings")).json()
  expect(current.providers.openai.apiKey).toBe("********")
})

test("an open tab restores saved credentials after its server session is replaced", async ({ page }) => {
  let socket: WebSocketRoute | undefined
  await page.routeWebSocket("**/api/browser-session/socket", route => { socket = route })
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  await page.goto("/")
  await expect.poll(() => Boolean(socket)).toBe(true)
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  const dialog = page.getByRole("main", { name: "LLM settings" })
  await dialog.locator('input[type="password"]').first().fill("unit-test-api-key")
  await dialog.getByRole("textbox", { name: "Credentials passphrase" }).fill("long local passphrase")
  await dialog.getByRole("button", { name: "Save settings" }).click()
  await expect(dialog).toBeHidden()

  const defaults = await (await page.request.get("/api/settings/defaults")).json()
  await page.request.put("/api/settings", { data: { settings: defaults.settings } })
  const cleared = await (await page.request.get("/api/settings")).json()
  expect(cleared.settings.providers.openai.apiKey).toBeFalsy()

  let failedSyncs = 0
  await page.route("**/api/settings", route => {
    if (route.request().method() === "PUT" && failedSyncs++ === 0) {
      return route.fulfill({ status: 503, body: "Model settings are temporarily unavailable." })
    }
    return route.continue()
  })
  socket!.send("replaced")
  await expect(page.getByRole("alert").filter({ hasText: "Check the connection and retry" })).toBeVisible()
  await page.getByRole("button", { name: "Retry" }).click()
  await expect(page.getByRole("heading", { name: "Explore what could happen." })).toBeVisible()
  await expect.poll(async () => (await (await page.request.get("/api/settings")).json()).settings.providers.openai.apiKey).toBe("********")
})

test("reset waits for the server to discard active credentials", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("simula.language", "en"))
  await page.goto("/")
  await page.getByRole("button", { name: "Settings", exact: true }).click()
  const settings = page.getByRole("main", { name: "LLM settings" })
  await settings.locator('input[type="password"]').first().fill("unit-test-api-key")
  await settings.getByRole("button", { name: /Roles/ }).click()
  await settings.getByRole("spinbutton", { name: "Concurrent model calls" }).fill("2")
  await settings.getByRole("textbox", { name: "Credentials passphrase" }).fill("long local passphrase")
  await settings.getByRole("button", { name: "Save settings" }).click()
  await expect(settings).toBeHidden()
  await page.reload()
  await expect(page.getByRole("heading", { name: "Unlock credentials" })).toBeVisible()

  let failedSyncs = 0
  await page.route("**/api/settings", route => {
    if (route.request().method() === "PUT" && failedSyncs++ === 0) {
      return route.fulfill({ status: 503, body: "Model settings are temporarily unavailable." })
    }
    return route.continue()
  })
  await page.getByRole("button", { name: "Reset provider credentials" }).click()
  const reset = page.getByRole("dialog", { name: "Reset provider credentials" })
  await reset.getByRole("button", { name: "Reset provider credentials" }).click()
  await expect(reset).toBeVisible()
  await expect(reset.getByRole("alert")).toContainText("Check the connection and retry")
  await reset.getByRole("button", { name: "Reset provider credentials" }).click()
  await expect(page.getByRole("heading", { name: "Explore what could happen." })).toBeVisible()
  const { settings: active } = await (await page.request.get("/api/settings")).json()
  expect(active.providers.openai.apiKey).toBeFalsy()
  expect(active.concurrency).toBe(2)
  const defaults = await (await page.request.get("/api/settings/defaults")).json()
  await page.request.put("/api/settings", { data: { settings: defaults.settings } })
  await page.reload()
  await expect(page.getByRole("heading", { name: "Explore what could happen." })).toBeVisible()
  await expect.poll(async () => (await (await page.request.get("/api/settings")).json()).settings.concurrency).toBe(2)
})
