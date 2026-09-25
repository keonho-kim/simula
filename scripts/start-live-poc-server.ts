/**
 * Purpose: Start an isolated local server with the exact Ornith model for browser qualification.
 * Pattern: Test composition root.
 * Usage: Started by playwright.live.config.ts after bun run build.
 * Related: server.ts, apps/web/e2e/live-poc.e2e.ts
 */
import { z } from "zod"

const MODEL = "ornith-1.5-35b-a3b"
const ENDPOINT = "http://127.0.0.1:1234"
if (process.env.SIMULA_TEST_MODEL === "1") throw new Error("Live PoC cannot run with the mock model.")
const response = await fetch(`${ENDPOINT}/api/v1/models`, { signal: AbortSignal.timeout(5000) })
const catalog = z.object({ models: z.array(z.object({ key: z.string(), loaded_instances: z.array(z.object({ id: z.string() })) })) }).parse(await response.json())
if (!response.ok || !catalog.models.some(model => model.key === MODEL && model.loaded_instances.some(instance => instance.id === MODEL))) {
  throw new Error(`Load ${MODEL} in local LM Studio before live browser qualification.`)
}
Object.assign(process.env, { PORT: "4019", NODE_ENV: "production", SIMULA_HTTPS: "1" })
await import("../server")
