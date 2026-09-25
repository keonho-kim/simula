/**
 * Purpose: Verify in-flight generation and confirmation retain their captured source revision.
 * Pattern: Runtime integration test with deterministic model output.
 * Usage: bun test src/backend/runtime/scenario-builder/source-revisions.test.ts
 * Related: src/backend/runtime/scenario-builder/jobs.ts, src/backend/storage/documents/source-revisions.ts
 */
import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { defaultSettings } from "@/backend/core/settings/defaults"
import { extractTextEvidence } from "@/backend/core/documents/text"
import { parseBuilderRequest } from "@/backend/core/scenario-builder/contracts"
import { DocumentStore } from "@/backend/storage/documents/document-store"
import { ScenarioBuildStore } from "@/backend/storage/scenario-builder/build-store"
import { testScenarioBuilderResponse } from "@/backend/integrations/llm/testing/scenario-builder-response"
import { ModelAdmission } from "@/backend/runtime/model-admission"
import { ScenarioBuilderJobs } from "./jobs"

test("a source edit during generation cannot replace evidence in later checks or prevent old-version confirmation", async () => {
  const root = await mkdtemp(join(tmpdir(), "simula-build-source-"))
  try {
    const documents = new DocumentStore(join(root, "documents"))
    const store = new ScenarioBuildStore(join(root, "scenarios"))
    const set = await documents.createSet()
    const bytes = new TextEncoder().encode("Review the investment conditions against the supplied materials.")
    const file = await documents.addFile(set.id, "source.txt", bytes)
    await documents.saveExtraction(set.id, file.id, extractTextEvidence(file.id, bytes))
    const revision = (await documents.readSet(set.id)).revision
    const request = parseBuilderRequest({ documentSetId: set.id, documentRevision: revision, language: "en", fastMode: true })
    const id = crypto.randomUUID()
    await store.create(id, request)
    const settings = defaultSettings()
    settings.providers.openai.apiKey = "unit-test-api-key"
    const prompts: string[] = []
    const jobs = new ScenarioBuilderJobs(store, documents, async () => settings, new ModelAdmission({ concurrency: 4 }), () => async call => {
      prompts.push(call.prompt)
      if (prompts.length === 1) {
        await documents.updateStatus(set.id, file.id, "processing")
        await documents.saveExtraction(set.id, file.id, extractTextEvidence(file.id, new TextEncoder().encode("REPLACEMENT_ONLY")))
        await documents.addFile(set.id, "later.txt", new TextEncoder().encode("LATER_ONLY"))
      }
      const text = testScenarioBuilderResponse(call.prompt)
      if (!text) throw new Error("Unknown test generation contract")
      return { text, truncated: false }
    })
    await jobs.start(id).completion
    expect((await store.read(id)).status).toBe("review")
    expect(prompts.length).toBeGreaterThan(1)
    expect(prompts.some(prompt => prompt.includes("REPLACEMENT_ONLY") || prompt.includes("LATER_ONLY"))).toBe(false)
    const confirmed = await jobs.confirm(id)
    expect(confirmed.status).toBe("confirmed")
    expect(confirmed.specification?.documentRevision).toBe(revision)
    expect((await documents.readSet(set.id)).revision).toBeGreaterThan(revision)
  } finally { await rm(root, { recursive: true, force: true }) }
})
