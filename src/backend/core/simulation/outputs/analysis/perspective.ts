/**
 * Purpose: Build a shared report perspective from four accepted short text fields.
 * Pattern: Sequential field workflow.
 * Usage: Called by the analytical graph before independent section branches.
 * Related: src/backend/core/simulation/outputs/analysis/graph.ts, src/shared/analytical-report-schema.ts
 */
import { analysisPerspectiveSchema } from "@/shared/analytical-report-schema"
import type { AnalysisTasks, EvidenceSummary } from "./contracts"
import { focusInstructions } from "./prompts/focus"
import { objectiveInstructions } from "./prompts/objective"
import { horizonInstructions } from "./prompts/horizon"
import { boundaryInstructions } from "./prompts/boundary"

export async function buildPerspective(tasks: AnalysisTasks, scenario: EvidenceSummary): Promise<string> {
  const common = { kind: "perspective" as const, output: "text" as const,
    parse: (text: string) => text.trim(), evidenceIds: scenario.evidenceIds }
  const focus = await tasks.run({ ...common, id: "perspective-focus", schema: analysisPerspectiveSchema.shape.focus,
    instruction: focusInstructions, shape: "one short focal decision or entity",
    input: { SCENARIO: { scenario } } })
  const objective = await tasks.run({ ...common, id: "perspective-objective", schema: analysisPerspectiveSchema.shape.objective,
    instruction: objectiveInstructions, shape: "one short evaluation objective",
    input: { SCENARIO: { scenario }, ANALYSIS: { focus } } })
  const horizon = await tasks.run({ ...common, id: "perspective-horizon", schema: analysisPerspectiveSchema.shape.horizon,
    instruction: horizonInstructions, shape: "one short time horizon or unspecified",
    input: { SCENARIO: { scenario }, ANALYSIS: { focus, objective } } })
  const boundary = await tasks.run({ ...common, id: "perspective-boundary", schema: analysisPerspectiveSchema.shape.boundary,
    instruction: boundaryInstructions, shape: "one short internal and external boundary statement",
    input: { SCENARIO: { scenario }, ANALYSIS: { focus, objective, horizon } } })
  const perspective = analysisPerspectiveSchema.parse({ focus, objective, horizon, boundary,
    evidenceIds: scenario.evidenceIds })
  await tasks.dependencies.saveTask({ id: "perspective", fingerprint: JSON.stringify(perspective), value: perspective, attempt: 0 })
  return "perspective"
}
