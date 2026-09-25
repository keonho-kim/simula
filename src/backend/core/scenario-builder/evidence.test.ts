/**
 * Purpose: Verify code-owned citations and indexed reduction of accepted source claims.
 * Pattern: Evidence workflow contract tests.
 * Usage: bun test src/backend/core/scenario-builder/evidence.test.ts
 * Related: src/backend/core/scenario-builder/evidence.ts, src/backend/core/generation/tasks.ts
 */
import { expect, test } from "bun:test"
import type { EvidenceBlock } from "@/shared/documents"
import { digestSchema } from "@/shared/scenario-builder-schema"
import { createGenerationTasks, type AcceptedGenerationTask } from "@/backend/core/generation/tasks"
import { parseBuilderRequest } from "./contracts"
import { buildEvidenceDigest } from "./evidence"

const documentId = "11111111-1111-4111-8111-111111111111"
const names = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"]
const blocks: EvidenceBlock[] = names.map((name, index) => ({ id: `${documentId}:text:${index}`, documentId,
  kind: "text", method: "native", content: `Condition ${name} is documented.`,
  locator: { kind: "text", startLine: index + 1, endLine: index + 1, startOffset: 0, endOffset: 30 } }))

test("source claims keep program-owned block IDs and reducer selects supplied indices", async () => {
  const accepted = new Map<string, AcceptedGenerationTask>()
  const calls: Array<{ id: string; prompt: string }> = []
  const request = parseBuilderRequest({ documentSetId: crypto.randomUUID(), documentRevision: 1, language: "en" })
  const tasks = createGenerationTasks(request, { modelRevision: "evidence-fixture", signal: new AbortController().signal,
    readTask: async id => accepted.get(id), saveTask: async task => { accepted.set(task.id, task) }, emit: async () => {},
    invoke: async call => {
      calls.push({ id: call.id, prompt: call.prompt })
      const text = call.id.includes("-claim-") ? blocks.find(block => block.id === call.evidenceIds[0])?.content ?? ""
        : call.id.endsWith("-select") ? "2,4" : call.id.endsWith("-gap") ? "0" : "Documented conditions affect the review."
      return { text, truncated: false }
    },
  })
  const ref = await buildEvidenceDigest(tasks, [documentId], async () => blocks)
  const result = await tasks.read(ref, digestSchema)
  expect(result.claims.map(claim => claim.evidenceIds)).toEqual([[blocks[1].id], [blocks[3].id]])
  expect(result.claims.map(claim => claim.text)).toEqual([blocks[1].content, blocks[3].content])
  expect(calls.every(call => !call.prompt.includes("Required JSON shape"))).toBe(true)
  expect(calls.filter(call => call.id.endsWith("-select"))).toHaveLength(1)
  const count = calls.length
  await buildEvidenceDigest(tasks, [documentId], async () => blocks)
  expect(calls).toHaveLength(count)
})

test("extracted PDF text governs visual-page quantities and both sources stay linked", async () => {
  const accepted = new Map<string, AcceptedGenerationTask>()
  const page = { kind: "page" as const, page: 1, element: "page 1" }
  const textBlock: EvidenceBlock = { id: `${documentId}:pdf:1`, documentId,
    kind: "text", method: "pdfjs", content: "The approved budget is 120.", locator: page }
  const visualBlock: EvidenceBlock = { id: `${documentId}:visual:1`, documentId,
    kind: "visual", method: "vlm", content: "The pictured budget appears to be 999.", locator: page }
  const calls: string[] = []
  const request = parseBuilderRequest({ documentSetId: crypto.randomUUID(), documentRevision: 1, language: "en" })
  const tasks = createGenerationTasks(request, { modelRevision: "visual-evidence-fixture", signal: new AbortController().signal,
    readTask: async id => accepted.get(id), saveTask: async task => { accepted.set(task.id, task) }, emit: async () => {},
    invoke: async call => {
      calls.push(call.id)
      const text = call.id.endsWith("-claim-2") && call.attempt === 1 ? "The approved budget is 999."
        : call.id.includes("-claim-") ? "The approved budget is 120."
        : call.id.endsWith("-gap") ? "0" : "The budget decision is pending."
      return { text, truncated: false }
    },
  })
  const ref = await buildEvidenceDigest(tasks, [documentId], async () => [textBlock, visualBlock])
  const result = await tasks.read(ref, digestSchema)
  expect(result.claims[1]?.text).toBe("The approved budget is 120.")
  expect(result.claims[1]?.evidenceIds).toEqual([visualBlock.id, textBlock.id])
  expect(calls.filter(id => id.endsWith("-claim-2"))).toHaveLength(2)
})
