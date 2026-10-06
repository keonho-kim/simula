/**
 * Purpose: Define the detail model instruction.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/simulation/outputs/analysis/branch.ts.
 * Related: src/backend/core/simulation/outputs/analysis/branch.ts, src/backend/core/prompts/blocks.ts
 */
import type { AnalysisSectionId } from "@/shared/analytical-report"
import { sectionInstructions as INSTRUCTIONS } from "./sections"
export function detailInstructions(id: AnalysisSectionId): string {
  return `Analytical report final section: ${id}. ${INSTRUCTIONS[id]} Write 3–6 connected paragraphs: main interpretation, specific evidence and mechanisms, then a qualified detailed conclusion. Answer the section question first, then explain which recorded actions support the interpretation and under what conditions it could differ. Address material counterevidence or missing observations. Avoid repeating the same finding across paragraphs or using generic recommendations to fill space. Preserve terminology and uncertainty. Do not invent new numbers or facts beyond accepted findings.`
}
