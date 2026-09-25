/**
 * Purpose: Define the detail model instruction.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/simulation/outputs/analysis/branch.ts.
 * Related: src/backend/core/simulation/outputs/analysis/branch.ts, src/backend/core/prompts/blocks.ts
 */
import type { AnalysisSectionId } from "@/shared/analytical-report"
import { sectionInstructions as INSTRUCTIONS } from "./sections"
export function detailInstructions(id: AnalysisSectionId): string {
  return `Analytical report final section: ${id}. ${INSTRUCTIONS[id]} Write 3–6 connected paragraphs: main interpretation, specific evidence and mechanisms, then a qualified detailed conclusion. Preserve terminology and uncertainty. Do not invent new numbers or facts beyond accepted findings.`
}
