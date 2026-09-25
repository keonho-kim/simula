/**
 * Purpose: Verify branch-specific reference choices preserve source and simulated provenance.
 * Pattern: Evidence-selection contract test.
 * Usage: bun test src/backend/core/simulation/outputs/analysis/findings.test.ts
 * Related: src/backend/core/simulation/outputs/analysis/findings.ts
 */
import { expect, test } from "bun:test"
import { createGenerationTasks, type AcceptedGenerationTask } from "@/backend/core/generation/tasks"
import { analysisFindingsSchema } from "@/shared/analytical-report-schema"
import type { AnalysisReference } from "@/shared/analytical-report"
import { buildSectionFindings } from "./findings"

test("actor behavior selects observations and material findings select documents", async () => {
  const source: AnalysisReference = { id: "source-1", category: "source_claim", text: "The document names a fixed budget." }
  const observed: AnalysisReference = { id: "obs-1", category: "simulation_observation", text: "In the simulated round, CTO asked for evidence." }
  const references = new Map([source, observed].map(value => [value.id, value]))
  const accepted = new Map<string, AcceptedGenerationTask>()
  const controller = new AbortController()
  const tasks = createGenerationTasks({ language: "en" as const, fastMode: false }, {
    modelRevision: "branch-provenance", signal: controller.signal,
    readTask: async id => accepted.get(id), saveTask: async task => { accepted.set(task.id, task) }, emit: async () => {},
    invoke: async call => ({ text: call.id.endsWith("-findings-summary") ? "The decision still needs evidence."
      : call.id.endsWith("-finding-count") || call.id.endsWith("-finding-1-source") ? "1"
      : call.id.endsWith("-finding-gap") ? "0" : "The actor asked for more evidence.", truncated: false }),
  })
  const perspective = { focus: "Decision", objective: "Review evidence", horizon: "Current review", boundary: "Internal approval", evidenceIds: [] }
  const packet = { SOURCE: { sources: { summary: "Fixed budget", evidenceIds: [source.id] } },
    SIMULATION: { observations: { summary: "CTO asked for evidence", evidenceIds: [observed.id] } } }
  const readReference = async (id: string) => references.get(id)
  const actorRef = await buildSectionFindings(tasks, "actors", perspective, packet, [source.id, observed.id], readReference)
  const actor = await tasks.read(actorRef, analysisFindingsSchema)
  expect(actor.findings[0]?.evidenceIds).toEqual([observed.id])
  const materialRef = await buildSectionFindings(tasks, "materials", perspective, packet, [observed.id, source.id], readReference)
  const materials = await tasks.read(materialRef, analysisFindingsSchema)
  expect(materials.findings[0]?.evidenceIds).toEqual([source.id])
})
