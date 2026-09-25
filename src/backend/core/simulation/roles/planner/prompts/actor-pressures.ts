/**
 * Purpose: Build the planner actor-pressures model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/planner/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import type { PlannerPromptBuilder } from "./contracts"

export const actorPressures: PlannerPromptBuilder = (_current, partial) =>
    `Planner actorPressures.
Summarize the main pressures, incentives, constraints, and asymmetries that different actors will feel.
Write one compact paragraph that downstream actor generation can reuse.
Return only the digest body. Do not include labels, headings, markdown, bullets, or prefixes.

${renderPromptBlock("PREVIOUS_RESULT", `Core situation digest: ${partial.coreSituation}`)}`
