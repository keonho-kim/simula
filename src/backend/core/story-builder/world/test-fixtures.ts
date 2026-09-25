/**
 * Purpose: Supply deterministic confirmed-scenario and model fixtures for world tests.
 * Pattern: Test fixture.
 * Usage: Imported by world graph and API contract tests.
 * Related: src/backend/core/story-builder/world/graph.test.ts, src/backend/api/worlds/world-controller.test.ts
 */
import type { ScenarioSpecification } from "@/shared/scenario-builder"
import type { AcceptedGenerationTask, GenerationCall, GenerationDependencies } from "@/backend/core/generation/tasks"

const sourceId = "11111111-1111-4111-8111-111111111111"
const documentId = "22222222-2222-4222-8222-222222222222"
const evidenceId = `${documentId}:text:1`
const privateEvidenceId = `${documentId}:text:2`
const facet = { summary: "An investment decision is pending.", assumptions: [], evidenceIds: [evidenceId] }
const rule = { entries: ["Only discuss the documented proposal."], assumptions: [], evidenceIds: [evidenceId] }
export const specification: ScenarioSpecification = {
  id: sourceId, version: 1, status: "confirmed", documentSetId: documentId, documentRevision: 2, language: "en",
  situation: { title: "Investment review", purpose: "Review the investment.", decision: "Proceed or revise.", setting: "A planning meeting.", assumptions: [], evidenceIds: [evidenceId] },
  facets: { goals: facet, constraints: facet, tensions: facet },
  participants: [
    { id: "participant-1", name: "CTO", personality: "Requires evidence.", authority: "Technical recommendation.", goal: "Find a feasible plan.", nameLocked: true, personalityLocked: true, evidenceIds: [evidenceId] },
    { id: "participant-2", name: "Finance", personality: "Tests assumptions carefully.", authority: "Budget recommendation.", goal: "Control expenditure.", nameLocked: true, personalityLocked: false, evidenceIds: [evidenceId] },
  ],
  rules: { information: { ...rule, entries: ["Finance initially knows the documented budget."] }, actions: rule, termination: { ...rule, entries: ["Record a decision and remaining conditions."] }, variation: { ...rule, entries: ["Opening emphasis may vary; source facts remain fixed."] } },
  sourceFacts: [{ id: "fact-1", text: "Finance knows the confidential budget freeze.", evidenceIds: [privateEvidenceId],
    audience: { kind: "participants", participantIds: ["participant-2"] } }],
  sourceEvidenceIds: [evidenceId, privateEvidenceId], issues: [],
}

export function dependencies() {
  const accepted = new Map<string, AcceptedGenerationTask>()
  const calls: GenerationCall[] = []
  const deps: GenerationDependencies = {
    modelRevision: "world-test", signal: new AbortController().signal,
    readTask: async id => accepted.get(id), saveTask: async task => { accepted.set(task.id, structuredClone(task)) }, emit: async () => {},
    invoke: async call => {
      calls.push(call)
      const text = call.id === "opening-setting" ? "A meeting room."
        : call.id === "opening-summary" ? "Participants begin reviewing the proposal."
        : call.id === "opening-assumption" ? "0"
        : call.id.startsWith("actor-") ? "Asks to review evidence."
        : call.id.startsWith("concern-") ? `PRIVATE-${call.id.replace(/-goal$/, "")}`
        : call.id === "agenda" || call.id === "information" ? "Review the proposal before deciding."
        : JSON.stringify({ issues: [] })
      return { text, truncated: false }
    },
  }
  return { deps, calls, accepted }
}
