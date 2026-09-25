/**
 * Purpose: Verify final scenario issue capacity differs from one check task's limit.
 * Pattern: Shared boundary contract test.
 * Usage: bun test src/shared/scenario-builder-schema.test.ts
 * Related: src/shared/scenario-builder-schema.ts, src/backend/core/scenario-builder/assembly.ts
 */
import { expect, test } from "bun:test"
import { checksSchema, specificationSchema } from "./scenario-builder-schema"

const evidenceIds: string[] = []
const facet = { summary: "Review the proposal.", assumptions: [], evidenceIds }
const rule = { entries: ["Record the next decision."], assumptions: [], evidenceIds }
const specification = {
  id: "44444444-4444-4444-8444-444444444444", version: 1, status: "blocked" as const,
  documentSetId: "33333333-3333-4333-8333-333333333333", documentRevision: 1, language: "en" as const,
  situation: { title: "Review", purpose: "Review the proposal.", decision: "Choose next steps.",
    setting: "A meeting.", assumptions: [], evidenceIds },
  facets: { goals: facet, constraints: facet, tensions: facet },
  participants: [{ id: "participant-1", name: "CTO", personality: "Careful.", authority: "Advises.",
    goal: "Choose next steps.", evidenceIds, nameLocked: true, personalityLocked: false }],
  rules: { information: rule, actions: rule, termination: rule, variation: rule },
  sourceFacts: [],
  sourceEvidenceIds: [], issues: [],
}

test("each check accepts six issues while the assembled scenario accepts up to one hundred", () => {
  const issues = Array.from({ length: 7 }, (_, index) => ({ scope: `part-${index}`, description: "Review this concern.", blocking: true }))
  expect(checksSchema.safeParse({ issues }).success).toBe(false)
  expect(specificationSchema.parse({ ...specification, issues }).issues).toHaveLength(7)
  expect(specificationSchema.safeParse({ ...specification, issues: Array.from({ length: 101 }, (_, index) => ({
    scope: `part-${index}`, description: "Review this concern.", blocking: true,
  })) }).success).toBe(false)
})

test("stored source access rejects foreign recipients and ungrounded citations", () => {
  const claim = { id: "fact-1", text: "The budget is under review.", evidenceIds: ["source:1"],
    audience: { kind: "participants" as const, participantIds: ["foreign"] } }
  const withEvidence = { ...specification, sourceEvidenceIds: ["source:1"] }
  expect(specificationSchema.safeParse({ ...withEvidence, sourceFacts: [claim] }).success).toBe(false)
  expect(specificationSchema.safeParse({ ...withEvidence, sourceFacts: [{ ...claim, id: "fact-2",
    audience: { kind: "participants", participantIds: ["participant-1"] } }] }).success).toBe(false)
  expect(specificationSchema.safeParse({ ...withEvidence, sourceFacts: [{ ...claim,
    audience: { kind: "participants", participantIds: ["participant-1"] }, evidenceIds: ["foreign:1"] }] }).success).toBe(false)
  expect(specificationSchema.safeParse({ ...withEvidence, status: "confirmed", sourceFacts: [{ ...claim,
    audience: { kind: "unresolved" } }] }).success).toBe(false)
})
