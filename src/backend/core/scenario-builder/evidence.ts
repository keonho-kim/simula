/**
 * Purpose: Reduce document blocks into concise claims with code-owned source references.
 * Pattern: Document frontiers and bounded synthesis tree.
 * Usage: Called by the evidence node of the shared scenario graph.
 * Related: src/backend/core/generation/tasks.ts, src/backend/core/documents/source-numbers.ts
 */
import { z } from "zod"
import type { EvidenceBlock } from "@/shared/documents"
import type { GroundedSummary } from "@/shared/scenario-builder"
import type { GenerationTaskScope } from "@/shared/generation"
import { digestSchema } from "@/shared/scenario-builder-schema"
import { mapGenerationTasks } from "@/backend/core/generation/tasks"
import { unsupportedSourceNumbers } from "@/backend/core/documents/source-numbers"
import { sourceClaimInstructions } from "./prompts/source-claim"
import { sourceOverviewInstructions } from "./prompts/source-overview"
import { sourceGapInstructions } from "./prompts/source-gap"
import { sourceSelectionInstructions } from "./prompts/source-selection"
import type { BuilderTasks, BuilderDependencies } from "./contracts"

const EVIDENCE_GROUP_SIZE = 3
const SUMMARY_FAN_IN = 3
const MAX_DIGEST_CLAIMS = 4
export const MAX_CLAIM_SOURCE_CITATIONS = 4
const shortText = z.string().trim().min(1).max(300)
const groundedText = (source: string) => shortText.superRefine((value, context) => {
  const unsupported = unsupportedSourceNumbers(value, source)
  if (unsupported.length) context.addIssue({ code: "custom",
    message: `Numbers ${unsupported.join(", ")} are absent from the supplied source.` })
})

export function summaryEvidenceIds(value: GroundedSummary): string[] {
  return [...new Set(value.claims.flatMap(claim => claim.evidenceIds))]
}

export async function buildEvidenceDigest(tasks: BuilderTasks, documentIds: readonly string[], readEvidence: BuilderDependencies["readEvidence"]): Promise<string> {
  const documentRoots = await mapGenerationTasks(documentIds, tasks.request.fastMode, async documentId => {
    const evidence = await readEvidence(documentId)
    if (!evidence.length) throw new Error(`Document ${documentId} has no usable evidence.`)
    if (evidence.some(block => block.documentId !== documentId)) throw new Error("Evidence crossed a document boundary.")
    const groups = Array.from({ length: Math.ceil(evidence.length / EVIDENCE_GROUP_SIZE) }, (_, index) =>
      evidence.slice(index * EVIDENCE_GROUP_SIZE, (index + 1) * EVIDENCE_GROUP_SIZE))
    // Documents run concurrently; chunks inside each document remain sequential.
    const leaves = await mapGenerationTasks(groups, false, async (blocks, index) =>
      buildLeaf(tasks, documentId, evidence, blocks, index))
    return reduceDigests(tasks, leaves, `document-${documentId}`, false, { kind: "document", id: documentId })
  })
  return reduceDigests(tasks, documentRoots, "sources", tasks.request.fastMode)
}

async function buildLeaf(tasks: BuilderTasks, documentId: string, evidence: readonly EvidenceBlock[],
  blocks: readonly EvidenceBlock[], index: number): Promise<string> {
  const id = `evidence-${documentId}-${index}`
  const scope = { kind: "document" as const, id: documentId }
  const claims: GroundedSummary["claims"] = []
  for (const [blockIndex, block] of blocks.entries()) {
    const page = block.locator.kind === "page" ? block.locator.page : undefined
    const extracted = block.method === "vlm" && page !== undefined
      ? evidence.filter(candidate => candidate.method === "pdfjs" && candidate.locator.kind === "page"
        && candidate.locator.page === page).slice(0, MAX_CLAIM_SOURCE_CITATIONS - 1)
      : []
    const evidenceIds = [block.id, ...extracted.map(candidate => candidate.id)]
    const source = extracted.length ? extracted.map(candidate => candidate.content).join("\n") : block.content
    const text = await tasks.run({ id: `${id}-claim-${blockIndex + 1}`, kind: "evidence", scope,
      schema: z.union([groundedText(source), z.literal("0")]),
      output: "text", parse: response => response.trim(),
      shape: "one concise source fact, or 0 if this block has no decision-relevant fact",
      instruction: sourceClaimInstructions,
      input: { USER_INPUT: { context: tasks.request.context }, SOURCE: { block,
        ...(extracted.length ? { authoritativeText: extracted.map(candidate => candidate.content) } : {}) } },
      evidenceIds })
    if (text !== "0") claims.push({ text, evidenceIds })
  }
  const summarySource = claims.length ? claims.map(claim => claim.text).join("\n") : blocks.map(block => block.content).join("\n")
  const sourceIds = [...new Set(blocks.map(block => block.id).concat(claims.flatMap(claim => claim.evidenceIds)))]
  const summary = await tasks.run({ id: `${id}-summary`, kind: "evidence", scope,
    schema: groundedText(summarySource),
    output: "text", parse: response => response.trim(),
    shape: "one short overview of the supplied source facts",
    instruction: sourceOverviewInstructions,
    input: { SOURCE: { claims: claims.map(claim => claim.text), blocks: claims.length ? undefined : blocks } },
    evidenceIds: sourceIds })
  const gap = await tasks.run({ id: `${id}-gap`, kind: "evidence", scope,
    schema: shortText, output: "text", parse: response => response.trim(),
    shape: "one missing detail or contradiction, or 0 if none is evident",
    instruction: sourceGapInstructions,
    input: { SOURCE: { blocks, claims: claims.map(claim => claim.text) } }, evidenceIds: sourceIds })
  const digest = digestSchema.parse({ summary, claims: claims.slice(0, MAX_DIGEST_CLAIMS), gaps: gap === "0" ? [] : [gap] })
  await tasks.dependencies.saveTask({ id, fingerprint: JSON.stringify(digest), value: digest, attempt: 0 })
  return id
}

async function reduceDigests(tasks: BuilderTasks, refs: string[], prefix: string, fastMode: boolean, scope?: GenerationTaskScope): Promise<string> {
  let frontier = refs
  for (let depth = 0;; depth++) {
    const groups = Array.from({ length: Math.ceil(frontier.length / SUMMARY_FAN_IN) }, (_, index) =>
      frontier.slice(index * SUMMARY_FAN_IN, (index + 1) * SUMMARY_FAN_IN))
    const next = await mapGenerationTasks(groups, fastMode, async (ids, index) => {
      const summaries = await Promise.all(ids.map(id => tasks.read(id, digestSchema)))
      const candidates = summaries.flatMap(summary => summary.claims)
      const id = `${prefix}-digest-${depth}-${index}`
      const evidenceIds = [...new Set(summaries.flatMap(summaryEvidenceIds))]
      const selected = candidates.length <= MAX_DIGEST_CLAIMS ? candidates : await selectClaims(tasks, id, candidates, scope, evidenceIds)
      const source = candidates.map(claim => claim.text).concat(summaries.map(summary => summary.summary)).join("\n")
      const summary = await tasks.run({ id: `${id}-summary`, kind: "digest", scope,
        schema: groundedText(source),
        output: "text", parse: response => response.trim(),
        shape: "one short overview of the accepted source facts",
        instruction: sourceOverviewInstructions,
        input: { SOURCE: { summaries: summaries.map(value => value.summary), claims: selected.map(claim => claim.text) } },
        evidenceIds })
      const gaps = [...new Set(summaries.flatMap(value => value.gaps))].slice(0, 4)
      const digest = digestSchema.parse({ summary, claims: selected, gaps })
      await tasks.dependencies.saveTask({ id, fingerprint: JSON.stringify(digest), value: digest, attempt: 0 })
      return id
    })
    if (next.length === 1) return next[0]
    frontier = next
  }
}

async function selectClaims(tasks: BuilderTasks, id: string, candidates: GroundedSummary["claims"],
  scope: GenerationTaskScope | undefined, evidenceIds: string[]): Promise<GroundedSummary["claims"]> {
  const indices = await tasks.run({ id: `${id}-select`, kind: "digest", scope,
    schema: z.array(z.number().int().min(1).max(candidates.length)).min(1).max(MAX_DIGEST_CLAIMS)
      .refine(values => new Set(values).size === values.length, "Choose distinct supplied indices."),
    output: "choice", parse: response => response.trim().split(/\s*,\s*/).map(Number),
    shape: `1 to ${MAX_DIGEST_CLAIMS} distinct indices from 1 to ${candidates.length}, separated by commas`,
    instruction: sourceSelectionInstructions,
    input: { SOURCE: { choices: candidates.map((claim, index) => ({ index: index + 1, text: claim.text })) } },
    evidenceIds })
  return indices.map(index => candidates[index - 1])
}
