/**
 * Purpose: Build the planner simulation-direction model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/planner/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import type { PlannerPromptBuilder } from "./contracts"

export const simulationDirection: PlannerPromptBuilder = (_current, partial) =>
    `Planner simulationDirection.
Summarize what the simulation should explore across rounds and what kind of resolution would count as meaningful.
Identify the competing choices, a plausible way actions could change the situation, and an observable stopping condition. Explore consequences rather than steering everyone toward agreement. Preserve uncertainty when no stopping condition is specified; do not impose a successful ending.
Write one compact paragraph that Coordinator and Actor roles can use as shared direction.
Return only the digest body. Do not include labels, headings, markdown, bullets, or prefixes.

${renderPromptBlock("PREVIOUS_RESULT", `Conflict dynamics digest: ${partial.conflictDynamics}`)}`
