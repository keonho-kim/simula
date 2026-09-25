/**
 * Purpose: Verify a failed admitted builder request persists unknown incurred usage.
 * Pattern: Runtime integration test.
 * Usage: bun test src/backend/runtime/scenario-builder/failure-accounting.test.ts
 * Related: src/backend/runtime/scenario-builder/jobs.ts, src/backend/integrations/llm/invoke.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { extractTextEvidence } from "@/backend/core/documents/text"
import { DocumentStore } from "@/backend/storage/documents/document-store"
import { ScenarioBuildStore } from "@/backend/storage/scenario-builder/build-store"
import { ModelAdmission } from "@/backend/runtime/model-admission"
import { ScenarioBuilderJobs } from "./jobs"

test("provider failure after admission is saved without fabricated token or latency metrics", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-builder-failure-"))
  let requests = 0
  const server = Bun.serve({ port: 0, fetch() { requests++; return Response.json({ error: { message: "Unavailable" } },
    { status: 503, headers: { "retry-after": "0" } }) } })
  try {
    const documents = new DocumentStore(join(root, "documents"))
    const set = await documents.createSet()
    const bytes = new TextEncoder().encode("The CTO must review the budget.")
    const file = await documents.addFile(set.id, "brief.txt", bytes)
    await documents.saveExtraction(set.id, file.id, extractTextEvidence(file.id, bytes))
    const ready = await documents.readSet(set.id)
    const settings = defaultSettings()
    settings.roles.storyBuilder = { ...settings.roles.storyBuilder, provider: "vllm", model: "local" }
    settings.providers.vllm = { apiKey: "test", baseUrl: `http://127.0.0.1:${server.port}/v1` }
    const store = new ScenarioBuildStore(join(root, "scenarios"))
    const id = crypto.randomUUID()
    await store.create(id, { documentSetId: set.id, documentRevision: ready.revision, context: "", situation: "auto",
      language: "en", fastMode: false, participants: [] })
    const jobs = new ScenarioBuilderJobs(store, documents, async () => settings, new ModelAdmission({ concurrency: 1 }))
    await jobs.start(id).completion
    expect((await store.read(id)).status).toBe("failed")
    expect(requests).toBe(3)
    expect(await store.readMetrics(id)).toHaveLength(0)
    expect((await store.readFailures(id))?.map(record => record.failure.attempt)).toEqual([1, 2, 3])
  } finally { await server.stop(true); await rm(root, { recursive: true, force: true }) }
})
