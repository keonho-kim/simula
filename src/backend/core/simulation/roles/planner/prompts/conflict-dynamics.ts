/**
 * Purpose: Build the planner conflict-dynamics model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/planner/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import type { PlannerPromptBuilder } from "./contracts"

export const conflictDynamics: PlannerPromptBuilder = (_current, partial) =>
    `Planner conflictDynamics.
Summarize how actor pressures are likely to collide through public, semi-public, private, and solitary actions.
Write one compact paragraph focused on interaction dynamics, not prose backstory.
Return only the digest body. Do not include labels, headings, markdown, bullets, or prefixes.

${renderPromptBlock("PREVIOUS_RESULT", `Actor pressure digest: ${partial.actorPressures}`)}`
