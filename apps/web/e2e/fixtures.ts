/**
 * Purpose: Give WebKit tests an OPFS-capable persistent profile while keeping other browser contexts.
 * Pattern: Playwright context fixture.
 * Usage: Imported by browser E2E tests instead of the default test fixture.
 * Related: playwright.config.ts, apps/web/e2e/webkit-persistent-storage.e2e.ts
 */
import { test as base, expect, webkit } from "@playwright/test"
import { mkdtemp, rm } from "node:fs/promises"
import { connect, createServer, type Socket } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"

export const test = base.extend({
  context: async ({ context, browserName, contextOptions, baseURL }, runTest) => {
    if (browserName !== "webkit") { await runTest(context); return }
    const profile = await mkdtemp(join(tmpdir(), "simula-webkit-e2e-"))
    const upstream = new URL(baseURL ?? "https://127.0.0.1:4011")
    const connections = new Set<Socket>()
    const tunnel = createServer(client => {
      const target = connect(Number(upstream.port), upstream.hostname)
      connections.add(client); connections.add(target)
      client.on("close", () => connections.delete(client))
      target.on("close", () => connections.delete(target))
      client.on("error", () => target.destroy())
      target.on("error", () => client.destroy())
      client.pipe(target).pipe(client)
    })
    try {
      await new Promise<void>(resolve => tunnel.listen(0, "127.0.0.1", resolve))
      const address = tunnel.address()
      if (!address || typeof address === "string") throw new Error("Missing isolated browser port.")
      const isolatedOrigin = `${upstream.protocol}//${upstream.hostname}:${address.port}`
      const persistent = await webkit.launchPersistentContext(profile,
        { ...contextOptions, baseURL: isolatedOrigin, headless: true })
      try { await runTest(persistent) }
      finally { await persistent.close() }
    } finally {
      for (const socket of connections) socket.destroy()
      await new Promise<void>(resolve => tunnel.close(() => resolve()))
      await rm(profile, { recursive: true, force: true })
    }
  },
})

export { expect, webkit }
export type { APIRequestContext, Page, Route } from "@playwright/test"
