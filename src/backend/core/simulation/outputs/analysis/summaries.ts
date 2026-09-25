/**
 * Purpose: Reduce bounded evidence into source-linked summaries with adaptive three-child synthesis.
 * Pattern: Evidence reduction tree.
 * Usage: Shared by material, scenario, world, and cross-world report preparation.
 * Related: src/backend/core/simulation/outputs/analysis/evidence.ts, src/shared/analytical-report-schema.ts
 */
import { evidenceInstructions } from "./prompts/evidence"
import { synthesisInstructions } from "./prompts/synthesis"
import type { PromptBlockName } from "@/backend/core/prompts/blocks"
import type { AnalysisReference } from "@/shared/analytical-report"
import { analyticalSummarySchema } from "@/shared/analytical-report-schema"
import { mapGenerationTasks } from "@/backend/core/generation/tasks"
import type { AnalysisDependencies, AnalysisTasks, EvidenceSummary } from "./contracts"

const FAN_IN = 3
const SHAPE = "one concise evidence summary, at most three sentences and 900 characters"
export const EMPTY_SUMMARY: EvidenceSummary = { summary: "No accepted evidence is available for this scope.", findings: [], evidenceIds: [] }

export async function summarizeReferences(tasks: AnalysisTasks, deps: AnalysisDependencies, prefix: string, references: AnalysisReference[]): Promise<EvidenceSummary> {
  const block: PromptBlockName = references.some(reference => reference.documentId) ? "SOURCE"
    : references.some(reference => reference.runId) ? "SIMULATION"
    : references.every(reference => reference.category === "user_constraint") ? "USER_INPUT" : "SCENARIO"
  const leaves: EvidenceSummary[] = []
  const observations = new Set(references.filter(reference => reference.category === "simulation_observation").map(reference => reference.id))
  for (let offset = 0; offset < references.length; offset += FAN_IN) {
    const group = references.slice(offset, offset + FAN_IN)
    await Promise.all(group.map(reference => deps.saveReference(reference)))
    const required = group.filter(reference => observations.has(reference.id)).map(reference => reference.id)
    leaves.push(await tasks.run({ id: `${prefix}-evidence-${offset / FAN_IN}`, kind: "report-evidence", schema: supportedSummary(required),
      output: "text", parse: (text: string) => ({ summary: text.trim(), findings: [], evidenceIds: group.map(value => value.id) }),
      shape: SHAPE, evidenceIds: group.map(value => value.id), input: { [block]: { references: group } },
      instruction: evidenceInstructions(required),
    }))
  }
  return reduceSummaries(tasks, `${prefix}-summary`, leaves, observations, block)
}

export async function reduceSummaries(tasks: AnalysisTasks, prefix: string, values: EvidenceSummary[], observations: ReadonlySet<string> = new Set(), block: PromptBlockName = "ANALYSIS"): Promise<EvidenceSummary> {
  if (!values.length) return EMPTY_SUMMARY
  let frontier = values
  for (let depth = 0; frontier.length > 1; depth++) {
    const groups = Array.from({ length: Math.ceil(frontier.length / FAN_IN) }, (_, index) => frontier.slice(index * FAN_IN, (index + 1) * FAN_IN))
    frontier = await mapGenerationTasks(groups, tasks.request.fastMode, (group, index) => summarizeGroup(tasks, prefix, depth, index, group, observations, block))
  }
  return frontier[0]
}

async function summarizeGroup(tasks: AnalysisTasks, prefix: string, depth: number, index: number, summaries: EvidenceSummary[], observations: ReadonlySet<string>, block: PromptBlockName) {
  const evidenceIds = [...new Set(summaries.flatMap(value => value.evidenceIds))]
  const required = evidenceIds.filter(id => observations.has(id))
  const retained = [...required, ...evidenceIds.filter(id => !observations.has(id))].slice(0, 8)
  return tasks.run({ id: `${prefix}-${depth}-${index}`, kind: "report-evidence", schema: supportedSummary(required), shape: SHAPE,
    output: "text", parse: (text: string) => ({ summary: text.trim(), findings: [], evidenceIds: retained }),
    evidenceIds, input: { [block]: { summaries: summaries.map(({ summary, evidenceIds: ids }) => ({ summary, evidenceIds: ids })) } },
    instruction: synthesisInstructions(required, summaries.length),
  })
}

function supportedSummary(observations: string[]) {
  return analyticalSummarySchema.refine(value => !observations.length || value.evidenceIds.some(id => observations.includes(id)),
    "Retain at least one supplied recorded observation reference; do not replace observed behavior with scenario assumptions alone.")
}
