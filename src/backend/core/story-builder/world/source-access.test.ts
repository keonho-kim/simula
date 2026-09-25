/**
 * Purpose: Verify world access projection rejects ambiguous audiences and tainted public premises.
 * Pattern: Pure access-policy contract tests.
 * Usage: bun test src/backend/core/story-builder/world/source-access.test.ts
 * Related: src/backend/core/story-builder/world/source-access.ts
 */
import { expect, test } from "bun:test"
import { specification } from "./test-fixtures"
import { assertPublicWorldPremises, sourceFactsForAudience } from "./source-access"

test("only granted facts are copied and unknown participants or unresolved audiences fail", () => {
  expect(sourceFactsForAudience(specification, null)).toEqual([])
  expect(sourceFactsForAudience(specification, "participant-1")).toEqual([])
  const known = sourceFactsForAudience(specification, "participant-2")
  expect(known[0]?.text).toBe(specification.sourceFacts[0]?.text)
  known[0]!.evidenceIds.push("changed")
  expect(specification.sourceFacts[0]?.evidenceIds).not.toContain("changed")
  expect(() => sourceFactsForAudience(specification, "missing")).toThrow("participant")
  const unresolved = structuredClone(specification)
  unresolved.sourceFacts[0]!.audience = { kind: "unresolved" }
  expect(() => sourceFactsForAudience(unresolved, null)).toThrow("unresolved")
})

test("public premises cannot carry a copied private fact or depend on restricted-only evidence", () => {
  expect(() => assertPublicWorldPremises(specification)).not.toThrow()
  const copied = structuredClone(specification)
  copied.situation.purpose = copied.sourceFacts[0]!.text
  expect(() => assertPublicWorldPremises(copied)).toThrow("public")
  copied.sourceFacts[0]!.text = 'The private code is "ORCHID-731".'
  copied.situation.purpose = copied.sourceFacts[0]!.text
  expect(() => assertPublicWorldPremises(copied)).toThrow("public")
  const paraphrased = structuredClone(specification)
  paraphrased.facets.constraints = { summary: "There is a hidden finance restriction.", assumptions: [],
    evidenceIds: [...paraphrased.sourceFacts[0]!.evidenceIds] }
  expect(() => assertPublicWorldPremises(paraphrased)).toThrow("evidence")
})
