/**
 * Purpose: Verify server run, settings, sample, model-discovery, and Story Builder APIs.
 * Pattern: HTTP integration test.
 * Usage: Executed by bun test against an isolated spawned server.
 * Related: apps/server/tests/server-test-support.ts, src/backend/api/routes.ts
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { join } from "node:path"
import { defaultSettings } from "@/backend/core/settings/defaults"
import type { LLMSettings } from "@/shared"
import { apiFetch, continueRoundsFromEventStream, pollRun, setProviderKey } from "./server-test-support"

const port = 3917
const baseUrl = `http://localhost:${port}`
const repoRoot = join(import.meta.dir, "../../..")
const serverEntry = join(repoRoot, "server.ts")
let processRef: ReturnType<typeof Bun.spawn>
let serverStdout = ""
let serverStderr = ""

beforeAll(async () => {
  processRef = Bun.spawn(["node", "--import", "tsx", serverEntry], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port),
      SIMULA_TEST_MODEL: "1",
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  if (processRef.stdout instanceof ReadableStream) {
    collectStream(processRef.stdout, (chunk) => {
      serverStdout += chunk
    })
  }
  if (processRef.stderr instanceof ReadableStream) {
    collectStream(processRef.stderr, (chunk) => {
      serverStderr += chunk
    })
  }
  await waitForServer()
  try {
    await apiFetch(`${baseUrl}/api/settings`)
  } catch (error) {
    throw new Error(
      `Server started but settings endpoint was unreachable: ${String(error)}\nstdout:\n${serverStdout}\nstderr:\n${serverStderr}`,
      { cause: error }
    )
  }
}, 45_000)

afterAll(async () => {
  processRef.kill()
  await processRef.exited.catch(() => undefined)
}, 30_000)

describe("server API", () => {
  test("rejects an unsafe browser execution identifier", async () => {
    const response = await apiFetch(`${baseUrl}/api/runs`, { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ executionId: "../escape",
        scenario: { text: "A bounded test scenario.", controls: { numCast: 2, actionsPerType: 1, maxRound: 1,
          allowAdditionalCast: false, fastMode: false } } }) })
    expect(response.status).toBe(400)
  })

  test("creates, runs, streams, and reports a completed run", async () => {
    const settings = defaultSettings()
    setProviderKey(settings, "unit-test-api-key")
    await apiFetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    })

    const executionId = crypto.randomUUID()
    const createResponse = await apiFetch(`${baseUrl}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        executionId,
        scenario: {
          sourceName: "api.md",
          text: "A product team debates a critical release.",
          controls: { numCast: 3, allowAdditionalCast: true, actionsPerType: 3, maxRound: 3, fastMode: false },
        },
      }),
    })
    const { run } = (await createResponse.json()) as { run: { id: string } }
    expect(run.id).toBe(executionId)

    const eventsController = new AbortController()
    const eventsResponse = await apiFetch(`${baseUrl}/api/runs/${run.id}/events`, { signal: eventsController.signal })
    expect(eventsResponse.ok).toBe(true)
    const eventPump = continueRoundsFromEventStream(baseUrl, run.id, eventsResponse)

    try {
      await apiFetch(`${baseUrl}/api/runs/${run.id}/start`, { method: "POST" })

      const completed = await pollRun(baseUrl, run.id, "completed")
      expect(completed.status).toBe("completed")
    } finally {
      eventsController.abort()
      await eventPump.catch(() => undefined)
    }

    const report = await apiFetch(`${baseUrl}/api/runs/${run.id}/report`).then((response) => response.text())
    expect(report).toContain("# Simula Report")

    const exported = await apiFetch(`${baseUrl}/api/runs/${run.id}/export?kind=jsonl`).then((response) =>
      response.text()
    )
    expect(exported).toContain("graph.delta")
    const interactions = exported.trim().split("\n")
      .map(line => JSON.parse(line) as { type: string; interaction?: { thought?: string } })
      .filter(event => event.type === "interaction.recorded")
    expect(interactions.length).toBeGreaterThan(0)
    expect(interactions.every(event => Boolean(event.interaction?.thought))).toBe(true)
  })

  test("fails explicitly when provider keys are missing", async () => {
    await apiFetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: defaultSettings() }),
    })
    const createResponse = await apiFetch(`${baseUrl}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario: {
          sourceName: "bad.md",
          text: "A run without keys should fail.",
          controls: { numCast: 2, allowAdditionalCast: true, actionsPerType: 3, maxRound: 3, fastMode: false },
        },
      }),
    })
    const { run } = (await createResponse.json()) as { run: { id: string } }
    await apiFetch(`${baseUrl}/api/runs/${run.id}/start`, { method: "POST" })
    const failed = await pollRun(baseUrl, run.id, "failed")
    expect(failed.error).toContain("API key is required")
  })

  test("logs retry attempts when a role node returns empty text", async () => {
    const settings = defaultSettings()
    setProviderKey(settings, "unit-test-api-key")
    settings.roles.planner.provider = "litellm"
    settings.providers.litellm.apiKey = "unit-test-empty-key"
    await apiFetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    })
    const createResponse = await apiFetch(`${baseUrl}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario: {
          sourceName: "retry.md",
          text: "A retry-sensitive run.",
          controls: { numCast: 2, allowAdditionalCast: true, actionsPerType: 3, maxRound: 3, fastMode: false },
        },
      }),
    })
    const { run } = (await createResponse.json()) as { run: { id: string } }
    await apiFetch(`${baseUrl}/api/runs/${run.id}/start`, { method: "POST" })
    const failed = await pollRun(baseUrl, run.id, "failed")
    expect(failed.error).toContain("planner.coreSituation failed after 5 empty responses")
    const exported = await apiFetch(`${baseUrl}/api/runs/${run.id}/export?kind=jsonl`).then((response) =>
      response.text()
    )
    const retryLogEvents = exported
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { type: string; message?: string })
      .filter(
        (event) =>
          event.type === "log" &&
          event.message?.includes("planner.coreSituation returned empty text")
      )
    expect(retryLogEvents).toHaveLength(5)
  })

  test("lists and reads scenario samples", async () => {
    const samplesResponse = await apiFetch(`${baseUrl}/api/scenarios/samples`)
    const { samples } = (await samplesResponse.json()) as {
      samples: Array<{ name: string; title: string; controls: { numCast: number } }>
    }
    expect(samples.some((sample) => sample.name === "README.md")).toBe(false)
    expect(samples.length).toBeGreaterThan(0)

    const sampleResponse = await apiFetch(`${baseUrl}/api/scenarios/samples/${samples[0]?.name}`)
    const { sample } = (await sampleResponse.json()) as {
      sample: { text: string; controls: { numCast: number } }
    }
    expect(sample.text.length).toBeGreaterThan(0)
    expect(sample.controls.numCast).toBeGreaterThan(0)
  })

  test("retains provider secrets and lists OpenAI-compatible models", async () => {
    const modelServer = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url)
        if (url.pathname === "/v1/models" && request.headers.get("authorization") === "Bearer provider-secret") {
          return Response.json({ data: [{ id: "local-model-a" }, { id: "local-model-b" }] })
        }
        return Response.json({ error: "unauthorized" }, { status: 401 })
      },
    })

    try {
      const settings = defaultSettings()
      settings.concurrency = 3
      settings.roles.actor.provider = "lmstudio"
      settings.roles.actor.model = "local-model-a"
      settings.providers.lmstudio.baseUrl = `http://localhost:${modelServer.port}/v1`
      settings.providers.lmstudio.apiKey = "provider-secret"

      await apiFetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })

      const sanitized = (await apiFetch(`${baseUrl}/api/settings`).then((response) => response.json())) as {
        settings: LLMSettings
      }
      expect(sanitized.settings.providers.lmstudio.apiKey).toBe("********")
      expect(sanitized.settings.concurrency).toBe(3)
      const invalid = await apiFetch(`${baseUrl}/api/settings`, { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { ...settings, concurrency: 51 } }) })
      expect(invalid.status).toBe(400)

      await apiFetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: sanitized.settings }),
      })

      const modelsResponse = await apiFetch(`${baseUrl}/api/settings/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "lmstudio",
          connection: sanitized.settings.providers.lmstudio,
        }),
      })
      const body = (await modelsResponse.json()) as { models: string[] }
      expect(modelsResponse.ok).toBe(true)
      expect(body.models).toEqual(["local-model-a", "local-model-b"])
    } finally {
      modelServer.stop(true)
    }
  })

  test("returns an explicit error when model discovery fails", async () => {
    const response = await apiFetch(`${baseUrl}/api/settings/models`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "lmstudio",
        connection: { baseUrl: "" },
      }),
    })
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(body.error).toContain("Base URL is required")
  })

  test("drafts a scenario with the StoryBuilder role", async () => {
    const settings = defaultSettings()
    settings.providers.openai.apiKey = "unit-test-api-key"
    await apiFetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    })

    const response = await apiFetch(`${baseUrl}/api/story-builder/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "A city council faces a controversial infrastructure vote." }],
        controls: { numCast: 4, allowAdditionalCast: true, actionsPerType: 3, maxRound: 8, fastMode: false },
      }),
    })
    const draft = (await response.json()) as { text: string }
    expect(response.ok).toBe(true)
    expect(draft.text).toContain("# Scenario Draft")
  })

  test("fails StoryBuilder explicitly when its key is missing", async () => {
    await apiFetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: defaultSettings() }),
    })
    const response = await apiFetch(`${baseUrl}/api/story-builder/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Draft a scenario." }],
        controls: { numCast: 3, allowAdditionalCast: true, actionsPerType: 3, maxRound: 8, fastMode: false },
      }),
    })
    const body = (await response.json()) as { error: string }
    expect(response.status).toBe(400)
    expect(body.error).toContain("API key is required for storyBuilder")
  })
})

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (processRef.exitCode !== null) {
      throw new Error(`Server exited before startup.\nstdout:\n${serverStdout}\nstderr:\n${serverStderr}`)
    }
    try {
      const response = await apiFetch(`${baseUrl}/api/runs`)
      if (response.ok) {
        return
      }
    } catch {
      await Bun.sleep(100)
    }
  }
  throw new Error(`Server did not start.\nstdout:\n${serverStdout}\nstderr:\n${serverStderr}`)
}

function collectStream(stream: ReadableStream<Uint8Array>, onChunk: (chunk: string) => void): void {
  void (async () => {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const result = await reader.read()
      if (result.done) {
        break
      }
      onChunk(decoder.decode(result.value, { stream: true }))
    }
  })()
}
