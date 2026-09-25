/**
 * Purpose: Request one grounded overview for an analytical branch.
 * Pattern: Prompt definition.
 * Usage: Called before selecting a branch's individual findings.
 * Related: src/backend/core/simulation/outputs/analysis/findings.ts
 */
import type { AnalysisSectionId } from "@/shared/analytical-report"
import { sectionInstructions } from "./sections"

export function findingSummaryInstructions(id: AnalysisSectionId): string {
  return `Analytical report ${id}. ${sectionInstructions[id]} Summarize the accepted source and simulated evidence for this branch in one short sentence. If evidence is insufficient, state that limitation. Distinguish observation from inference. Return plain text, not JSON or references.`
}
