/**
 * Purpose: Supply deterministic report evidence and bounded model responses for workflow tests.
 * Pattern: Test fixture.
 * Usage: Used by analytical graph tests without external models.
 * Related: src/backend/core/simulation/outputs/analysis/graph.test.ts
 */
import type { GenerationCall, AcceptedGenerationTask } from "@/backend/core/generation/tasks"
import type { AnalysisDependencies, AnalysisInput } from "./contracts"
import type { AnalysisReference } from "@/shared/analytical-report"
import { extractTextEvidence } from "@/backend/core/documents/text"

export function analysisFixture() {
  const documentId = "11111111-1111-4111-8111-111111111111"
  const input: AnalysisInput = { subject: { kind: "batch", id: "22222222-2222-4222-8222-222222222222" }, language: "en", fastMode: true,
    scenarioText: "CTO and Finance must decide on a documented investment with a budget of 120 million won. Any agreement must preserve budget limits.",
    scenarioCategory: "scenario_assumption", documentIds: [documentId],
    worlds: [{ id: "first", runId: "run-first", status: "completed" }, { id: "second", runId: "run-second", status: "completed" },
      { id: "failed", status: "failed" }, { id: "canceled", status: "canceled" }, { id: "interrupted", status: "interrupted" }],
  }
  const artifacts = new Map<string, AcceptedGenerationTask>()
  const references = new Map<string, AnalysisReference>()
  const calls: GenerationCall[] = []
  const dependencies: AnalysisDependencies = {
    signal: new AbortController().signal, modelRevision: "test-model",
    readTask: async id => artifacts.get(id), saveTask: async value => { artifacts.set(value.id, structuredClone(value)) },
    saveReference: async value => { references.set(value.id, value) }, emit: async () => {},
    readReference: async id => references.get(id),
    readDocument: async id => extractTextEvidence(id, new TextEncoder().encode("The approved budget is 120 million won. Cost evidence remains incomplete.")).blocks,
    readWorld: async runId => ({ runId, actors: [{ id: "finance", name: "Finance", role: "Budget recommendation" }],
      interactions: [{ id: "speech-1", roundIndex: 1, sourceActorId: "finance", targetActorIds: [], actionType: "Request evidence", intent: "Reduce uncertainty", content: "Please verify the cost before approval." }],
      roundReports: [{ roundIndex: 1, title: "Review", roundSummary: "The decision was deferred pending cost evidence." }], roundDigests: [], stopReason: "simulation_done" }),
    invoke: async call => { calls.push(call); return { text: call.kind === "report-evidence"
      ? "A constrained investment decision depends on supporting evidence."
      : call.kind === "perspective" ? perspectiveResponse(call.id)
      : call.kind === "conclusion" ? conclusionResponse(call.id)
      : call.id.endsWith("-findings-summary") ? "The review is constrained by incomplete cost evidence."
      : call.id.endsWith("-finding-count") ? call.evidenceIds.length ? "1" : "0"
      : /-finding-\d+-source$/.test(call.id) ? "1"
      : /-finding-\d+-text$/.test(call.id) ? "The recorded decision waits for supporting cost evidence."
      : call.id.endsWith("-finding-gap") ? "Real-world outcomes are unverified."
      : call.kind === "trajectory" && call.id.endsWith("-count") ? "1"
      : call.kind === "trajectory" && /-label-\d+$/.test(call.id) ? "Evidence request then deferral"
      : call.kind === "trajectory" && /-description-\d+$/.test(call.id) ? "A decision waits for additional cost evidence."
      : call.id.endsWith("-score") ? "2" : call.id.startsWith("trajectory-world-") ? "1"
        : call.id.endsWith("-detail") ? "The recorded review remains conditional on cost evidence.\n\nParticipants deferred approval during this simulation.\n\nAdditional source evidence is needed before a real-world decision."
          : JSON.stringify(reportResponse(call)), truncated: false } },
  }
  return { input, dependencies, artifacts, references, calls }
}

export function reportResponse(call: GenerationCall): unknown {
  const evidenceIds = call.evidenceIds.slice(0, 2)
  if (call.kind === "report-evidence") return { summary: "A constrained investment decision depends on supporting evidence.", findings: ["Approval requires verified costs."], evidenceIds }
  if (call.kind === "check") return { issues: [] }
  if (call.id.endsWith("-score")) return { value: evidenceIds.length ? 2 : null, rationale: "The supplied evidence shows a material influence within the review.", evidenceIds }
  return { summary: "The review is constrained by incomplete cost evidence.", findings: evidenceIds.length ? [{ text: "The recorded decision waits for supporting cost evidence.", evidenceIds }] : [], gaps: ["Real-world outcomes are unknown."], evidenceIds }
}

function perspectiveResponse(id: string): string {
  const fields: Record<string, string> = {
    "perspective-focus": "Investment committee",
    "perspective-objective": "Reach a supported decision",
    "perspective-horizon": "This investment review",
    "perspective-boundary": "Internal decision capacity versus external cost uncertainty",
  }
  return fields[id] ?? ""
}

function conclusionResponse(id: string): string {
  if (id.endsWith("-summary")) return id.startsWith("conclusion-source")
    ? "The document leaves costs unverified." : "The simulated decision remains conditional."
  return id.startsWith("conclusion-source")
    ? "The document records a budget and leaves costs unverified. These claims do not establish available cash or a feasible investment. Further source evidence is needed."
    : "The simulated participants deferred approval pending cost evidence. This observed sequence belongs to the supplied worlds. It does not establish a real-world outcome."
}
