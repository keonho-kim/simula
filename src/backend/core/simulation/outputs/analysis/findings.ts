/**
 * Purpose: Assemble branch findings from short text and finite source-index choices.
 * Pattern: Sequential evidence-selection workflow.
 * Usage: Called by each analytical section branch before scoring and detail prose.
 * Related: src/backend/core/simulation/outputs/analysis/branch.ts, src/shared/analytical-report-schema.ts
 */
import { z } from "zod"
import type { AnalysisPerspective, AnalysisSectionId } from "@/shared/analytical-report"
import { analysisFindingsSchema, MAX_ANALYSIS_REFERENCES } from "@/shared/analytical-report-schema"
import type { PromptBlocks } from "@/backend/core/prompts/blocks"
import type { AnalysisDependencies, AnalysisTasks } from "./contracts"
import { findingSummaryInstructions } from "./prompts/finding-summary"
import { findingCountInstructions } from "./prompts/finding-count"
import { findingSourceInstructions } from "./prompts/finding-source"
import { findingTextInstructions } from "./prompts/finding-text"
import { findingGapInstructions } from "./prompts/finding-gap"

export async function buildSectionFindings(tasks: AnalysisTasks, id: AnalysisSectionId, perspective: AnalysisPerspective, packet: PromptBlocks,
  evidenceIds: string[], readReference: AnalysisDependencies["readReference"]): Promise<string> {
  const allowedIds = [...new Set(evidenceIds)].slice(0, MAX_ANALYSIS_REFERENCES)
  const available = await Promise.all(allowedIds.map(async referenceId => {
    const reference = await readReference(referenceId)
    if (!reference || reference.id !== referenceId) throw new Error(`Report reference ${referenceId} is unavailable.`)
    return reference
  }))
  const references = id === "actors" || id === "trajectories"
    ? available.filter(reference => reference.category === "simulation_observation")
    : id === "materials" ? available.filter(reference => reference.category === "source_claim" || reference.category === "user_constraint")
      : available
  const acceptedIds = references.map(reference => reference.id)
  const choices = references.map((reference, index) => ({ index: index + 1,
    category: reference.category, text: reference.text.slice(0, 180) }))
  const kind = ["strengths", "weaknesses", "opportunities", "threats"].includes(id) ? "swot" as const : "assessment" as const
  const common = { kind, evidenceIds: acceptedIds }
  const summary = await tasks.run({ ...common, id: `${id}-findings-summary`, schema: analysisFindingsSchema.shape.summary,
    output: "text", parse: (text: string) => text.trim(), instruction: findingSummaryInstructions(id),
    shape: "one short grounded overview sentence", input: packet })
  const count = references.length ? await tasks.run({ ...common, id: `${id}-finding-count`,
    schema: z.number().int().min(0).max(Math.min(3, references.length)), output: "choice",
    parse: (text: string) => {
      const answer = text.trim()
      if (!/^\d+$/.test(answer)) throw new Error("Choose one supplied finding count.")
      return Number(answer)
    },
    instruction: findingCountInstructions, shape: `one digit from 0 to ${Math.min(3, references.length)}`,
    input: { ANALYSIS: { perspective, branch: id, summary }, OPTIONS: { references: choices } },
  }) : 0
  const findings: z.infer<typeof analysisFindingsSchema>["findings"] = []
  for (let index = 0; index < count; index++) {
    const selected = await tasks.run({ ...common, id: `${id}-finding-${index + 1}-source`,
      schema: z.number().int().min(1).max(references.length), output: "choice",
      parse: (text: string) => {
        const answer = text.trim()
        if (!/^\d+$/.test(answer)) throw new Error("Choose one supplied reference index.")
        return Number(answer)
      },
      instruction: findingSourceInstructions, shape: `one reference index from 1 to ${references.length}`,
      input: { ANALYSIS: { perspective, branch: id, summary }, OPTIONS: { references: choices },
        PREVIOUS_RESULT: { findings: findings.map(value => value.text) } },
    })
    const reference = references[selected - 1]
    const text = await tasks.run({ ...common, id: `${id}-finding-${index + 1}-text`,
      schema: analysisFindingsSchema.shape.findings.element.shape.text, output: "text",
      parse: (response: string) => response.trim(), instruction: findingTextInstructions,
      shape: "one short finding sentence supported by the selected reference",
      input: { ...packet, ANALYSIS: { perspective, branch: id, summary, selectedReference: {
        category: reference.category, text: reference.text.slice(0, 500) } },
        PREVIOUS_RESULT: { findings: findings.map(value => value.text) } }, evidenceIds: [reference.id],
    })
    findings.push({ text, evidenceIds: [reference.id] })
  }
  const gap = await tasks.run({ ...common, id: `${id}-finding-gap`, schema: analysisFindingsSchema.shape.gaps.element,
    output: "text", parse: (text: string) => text.trim(), instruction: findingGapInstructions,
    shape: "one concise uncertainty sentence, or 0 if none",
    input: { ...packet, ANALYSIS: { perspective, branch: id, summary, findings } },
  })
  const result = analysisFindingsSchema.parse({ summary, findings, gaps: gap === "0" ? [] : [gap], evidenceIds: acceptedIds })
  const taskId = `${id}-findings`
  await tasks.dependencies.saveTask({ id: taskId, fingerprint: JSON.stringify(result), value: result, attempt: 0 })
  return taskId
}
