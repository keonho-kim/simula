/**
 * Purpose: Verify source-fact audiences are exact, scoped, repairable and confirmation-safe.
 * Pattern: Generation boundary and scenario assembly tests.
 * Usage: bun test src/backend/core/scenario-builder/source-access.test.ts
 * Related: src/backend/core/scenario-builder/source-access.ts, src/backend/core/scenario-builder/assembly.ts
 */
import { expect, test } from "bun:test"
import { createGenerationTasks, type AcceptedGenerationTask, type GenerationCall } from "@/backend/core/generation/tasks"
import { specificationSchema } from "@/shared/scenario-builder-schema"
import type { GroundedSummary } from "@/shared/scenario-builder"
import type { ScenarioParticipant } from "@/shared/participants"
import { assembleScenario, scheduleScenarioRepairs } from "./assembly"
import { parseBuilderRequest } from "./contracts"
import { initialBuilderState } from "./state"
import { buildSourceAccess, parseSourceAudienceChoice, readSourceFacts, restrictedFactsInPublicText } from "./source-access"

const evidenceId = "11111111-1111-4111-8111-111111111111:text:1"
const digest: GroundedSummary = { summary: "Budget and timing are under review.", claims: [
  { text: "The approved budget is 120.", evidenceIds: [evidenceId] },
  { text: "The review begins on May 12.", evidenceIds: [evidenceId] },
], gaps: [] }
const participants: ScenarioParticipant[] = [
  { id: "participant-1", name: "CTO", authority: "Technical review", goal: "Plan the release",
    personality: "Careful", evidenceIds: [], nameLocked: true, personalityLocked: false },
  { id: "participant-2", name: "Finance", authority: "Budget review", goal: "Control expenditure",
    personality: "Practical", evidenceIds: [], nameLocked: true, personalityLocked: false },
]
function fixture() {
  const accepted = new Map<string, AcceptedGenerationTask>()
  const save = (id: string, value: unknown) => accepted.set(id, { id, value, fingerprint: "fixture", attempt: 1 })
  save("digest", digest)
  participants.forEach(participant => save(participant.id, participant))
  save("rule-information", { entries: ["Only Finance knows the documented budget initially; timing is shared."], assumptions: [], evidenceIds: [evidenceId] })
  const calls: GenerationCall[] = []
  const request = parseBuilderRequest({ documentSetId: "33333333-3333-4333-8333-333333333333", documentRevision: 1,
    language: "en", participants: participants.map(participant => ({ name: participant.name })) })
  const tasks = createGenerationTasks(request, { modelRevision: "source-access-test", signal: new AbortController().signal,
    readTask: async id => accepted.get(id), saveTask: async task => { accepted.set(task.id, task) }, emit: async () => {},
    invoke: async call => { calls.push(call); return { text: call.id.endsWith("fact-1") ? "2" : "0", truncated: false } },
  })
  return { tasks, accepted, save, calls }
}

function seedPublicScenario(f: ReturnType<typeof fixture>, purpose = "Review the budget.") {
  const facet = { summary: "Review the budget and timing.", assumptions: [], evidenceIds: [evidenceId] }
  const rule = { entries: ["Record the decision."], assumptions: [], evidenceIds: [evidenceId] }
  f.save("situation", { title: "Review", purpose, decision: "Proceed or revise.",
    setting: "A meeting.", assumptions: [], evidenceIds: [evidenceId] })
  for (const name of ["goals", "constraints", "tensions"]) f.save(`facet-${name}`, facet)
  for (const name of ["actions", "termination", "variation"]) f.save(`rule-${name}`, rule)
  return { ...initialBuilderState("44444444-4444-4444-8444-444444444444", []),
    digestRef: "digest", situationRef: "situation", facetRefs: ["facet-goals", "facet-constraints", "facet-tensions"],
    participantRefs: participants.map(value => value.id), sourceAccessRef: "source-access" }
}

test("one complete indexed choice resolves to the supplied participants", () => {
  expect(parseSourceAudienceChoice("0", participants)).toEqual({ kind: "public" })
  expect(parseSourceAudienceChoice("2,1", participants)).toEqual({ kind: "public" })
  expect(parseSourceAudienceChoice("2", participants)).toEqual({ kind: "participants", participantIds: ["participant-2"] })
  expect(parseSourceAudienceChoice("?", participants)).toEqual({ kind: "unresolved" })
  for (const text of ["", "3", "1,1", "0,1", "1,", "[1]", "1 because Finance knows", "1\n2"]) {
    expect(() => parseSourceAudienceChoice(text, participants)).toThrow()
  }
})

test("bounded repair keeps accepted source wording and cites the recipient's exact participant ID", async () => {
  const f = fixture()
  const original = f.tasks.dependencies.invoke
  f.tasks.dependencies.invoke = async call => {
    if (call.id.endsWith("fact-1") && call.attempt === 1) {
      f.calls.push(call)
      return { text: "3", truncated: false }
    }
    return original(call)
  }
  const ref = await buildSourceAccess(f.tasks, "digest", participants.map(value => value.id), "rule-information")
  expect(f.calls).toHaveLength(3)
  const facts = await readSourceFacts(f.tasks, "digest", participants.map(value => value.id), ref)
  expect(facts).toEqual([
    { id: "fact-1", ...digest.claims[0], audience: { kind: "participants", participantIds: ["participant-2"] } },
    { id: "fact-2", ...digest.claims[1], audience: { kind: "public" } },
  ])
  expect(f.calls.find(call => call.id.endsWith("fact-1"))?.prompt).toContain("Only Finance knows the documented budget initially")
  await buildSourceAccess(f.tasks, "digest", participants.map(value => value.id), "rule-information")
  expect(f.calls).toHaveLength(3)
})

test("unresolved access remains reviewable but cannot be confirmed", async () => {
  const f = fixture()
  f.save("source-access-fact-1", { kind: "unresolved" })
  f.save("source-access-fact-2", { kind: "public" })
  const state = seedPublicScenario(f)
  const result = await assembleScenario(f.tasks, state)
  expect(result.status).toBe("blocked")
  expect(result.issues.some(issue => issue.scope === "source-access" && issue.blocking)).toBe(true)
  expect(result.sourceFacts[0]?.audience.kind).toBe("unresolved")
  expect(specificationSchema.safeParse({ ...result, status: "confirmed" }).success).toBe(false)
})

test("a restricted source claim copied into public prose repairs that unit and blocks uncorrected confirmation", async () => {
  const f = fixture()
  f.save("source-access-fact-1", { kind: "participants", participantIds: ["participant-2"] })
  f.save("source-access-fact-2", { kind: "public" })
  const facts = [{ id: "fact-1", ...digest.claims[0], audience: { kind: "participants" as const, participantIds: ["participant-2"] } },
    { id: "fact-2", ...digest.claims[1], audience: { kind: "public" as const } }]
  expect(restrictedFactsInPublicText(facts, [{ target: "situation", text: "The approved budget is 120." }])).toEqual([
    { factId: "fact-1", target: "situation" },
  ])
  expect(restrictedFactsInPublicText(facts, [{ target: "situation", text: "A public review without the budget amount." }])).toEqual([])
  const state = seedPublicScenario(f, "The approved budget is 120.")
  expect(await scheduleScenarioRepairs(f.tasks, state)).toBe(true)
  expect([...f.tasks.repairs.keys()]).toEqual(["situation-purpose"])
  const result = await assembleScenario(f.tasks, state)
  expect(result.status).toBe("blocked")
  expect(result.issues.some(issue => issue.description.includes("Restricted source fact fact-1"))).toBe(true)
})
