/**
 * Purpose: Verify a queued model call rechecks its owner before contacting the provider.
 * Pattern: Model-boundary ownership contract test.
 * Usage: bun test src/backend/integrations/llm/ownership.test.ts
 * Related: src/backend/integrations/llm/invoke.ts, src/backend/integrations/llm/execution-context.ts
 */
import { expect, test } from "bun:test"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { invokeRoleTextWithMetrics } from "./invoke"
import { runWithModelExecution } from "./execution-context"

test("losing ownership in the admission queue releases capacity without a provider request", async () => {
  let requests = 0, releases = 0, failures = 0, active = true
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  const server = Bun.serve({ port: 0, fetch() { requests++; return Response.json({ error: "Unexpected request" }, { status: 400 }) } })
  const settings = defaultSettings()
  settings.roles.planner = { ...settings.roles.planner, provider: "vllm", model: "local" }
  settings.providers.vllm = { apiKey: "test", baseUrl: `http://127.0.0.1:${server.port}/v1` }
  const work = runWithModelExecution({ owner: "queued-owner", signal: new AbortController().signal,
    admission: { acquire: async () => { entered.resolve(); await release.promise; return () => { releases++ } } },
    assertActive: () => { if (!active) throw new Error("Execution ownership lost") },
    onModelCallFailure: async () => { failures++ },
  }, () => invokeRoleTextWithMetrics(settings, "planner", "coreSituation", 1, "Describe the situation."))
  const outcome = work.then(() => undefined, error => error)
  try {
    await entered.promise
    active = false; release.resolve()
    expect(await outcome).toBeInstanceOf(Error)
    expect(requests).toBe(0)
    expect(releases).toBe(1)
    expect(failures).toBe(0)
  } finally { release.resolve(); await outcome; await server.stop(true) }
})
