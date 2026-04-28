import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { MODEL_ROLES, defaultSettings } from "@simula/core"
import type { LLMSettings, ModelProvider } from "@simula/shared"

const port = 3917
const baseUrl = `http://localhost:${port}`
let dataDir = ""
let settingsPath = ""
let processRef: ReturnType<typeof Bun.spawn>

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "simula-server-runs-"))
  settingsPath = join(dataDir, "settings.json")
  processRef = Bun.spawn(["bun", "apps/server/src/index.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      SIMULA_DATA_DIR: dataDir,
      SIMULA_SETTINGS_PATH: settingsPath,
    },
    stdout: "pipe",
    stderr: "pipe",
  })
  await waitForServer()
})

afterAll(async () => {
  processRef.kill()
  await processRef.exited.catch(() => undefined)
  await rm(dataDir, { recursive: true, force: true })
})

describe("server API", () => {
  test("creates, runs, streams, and reports a completed run", async () => {
    const settings = defaultSettings()
    setProviderKey(settings, "unit-test-api-key")
    await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    })

    const createResponse = await fetch(`${baseUrl}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenario: {
          sourceName: "api.md",
          text: "A product team debates a critical release.",
          controls: { numCast: 3, allowAdditionalCast: true, actionsPerType: 3, maxRound: 3, fastMode: false },
        },
      }),
    })
    const { run } = (await createResponse.json()) as { run: { id: string } }

    const eventsResponse = await fetch(`${baseUrl}/api/runs/${run.id}/events`)
    expect(eventsResponse.ok).toBe(true)
    await fetch(`${baseUrl}/api/runs/${run.id}/start`, { method: "POST" })

    const completed = await pollRun(run.id, "completed")
    expect(completed.status).toBe("completed")

    const report = await fetch(`${baseUrl}/api/runs/${run.id}/report`).then((response) => response.text())
    expect(report).toContain("# Simula Report")

    const exported = await fetch(`${baseUrl}/api/runs/${run.id}/export?kind=jsonl`).then((response) =>
      response.text()
    )
    expect(exported).toContain("graph.delta")
  })

  test("fails explicitly when provider keys are missing", async () => {
    await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: defaultSettings() }),
    })
    const createResponse = await fetch(`${baseUrl}/api/runs`, {
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
    await fetch(`${baseUrl}/api/runs/${run.id}/start`, { method: "POST" })
    const failed = await pollRun(run.id, "failed")
    expect(failed.error).toContain("API key is required")
  })

  test("logs retry attempts when a role node returns empty text", async () => {
    const settings = defaultSettings()
    setProviderKey(settings, "unit-test-api-key")
    settings.roles.planner.provider = "litellm"
    settings.providers.litellm.apiKey = "unit-test-empty-key"
    await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    })
    const createResponse = await fetch(`${baseUrl}/api/runs`, {
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
    await fetch(`${baseUrl}/api/runs/${run.id}/start`, { method: "POST" })
    const failed = await pollRun(run.id, "failed")
    expect(failed.error).toContain("planner.coreSituation failed after 5 empty responses")
    const exported = await fetch(`${baseUrl}/api/runs/${run.id}/export?kind=jsonl`).then((response) =>
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
    const samplesResponse = await fetch(`${baseUrl}/api/scenarios/samples`)
    const { samples } = (await samplesResponse.json()) as {
      samples: Array<{ name: string; title: string; controls: { numCast: number } }>
    }
    expect(samples.some((sample) => sample.name === "README.md")).toBe(false)
    expect(samples.length).toBeGreaterThan(0)

    const sampleResponse = await fetch(`${baseUrl}/api/scenarios/samples/${samples[0]?.name}`)
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
      settings.roles.actor.provider = "lmstudio"
      settings.roles.actor.model = "local-model-a"
      settings.providers.lmstudio.baseUrl = `http://localhost:${modelServer.port}/v1`
      settings.providers.lmstudio.apiKey = "provider-secret"

      await fetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })

      const sanitized = (await fetch(`${baseUrl}/api/settings`).then((response) => response.json())) as {
        settings: LLMSettings
      }
      expect(sanitized.settings.providers.lmstudio.apiKey).toBe("********")

      await fetch(`${baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: sanitized.settings }),
      })

      const modelsResponse = await fetch(`${baseUrl}/api/settings/models`, {
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
    const response = await fetch(`${baseUrl}/api/settings/models`, {
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
    await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    })

    const response = await fetch(`${baseUrl}/api/story-builder/draft`, {
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
    await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: defaultSettings() }),
    })
    const response = await fetch(`${baseUrl}/api/story-builder/draft`, {
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
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/runs`)
      if (response.ok) {
        return
      }
    } catch {
      await Bun.sleep(100)
    }
  }
  throw new Error("Server did not start.")
}

async function pollRun(runId: string, status: "completed" | "failed") {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const data = (await fetch(`${baseUrl}/api/runs/${runId}`).then((response) => response.json())) as {
      run: { status: string; error?: string }
    }
    if (data.run.status === status) {
      return data.run
    }
    await Bun.sleep(100)
  }
  throw new Error(`Run did not reach ${status}.`)
}

function setProviderKey(settings: LLMSettings, apiKey: string, provider: ModelProvider = "openai"): void {
  settings.providers[provider].apiKey = apiKey
  for (const role of MODEL_ROLES) {
    settings.roles[role].provider = provider
  }
}
