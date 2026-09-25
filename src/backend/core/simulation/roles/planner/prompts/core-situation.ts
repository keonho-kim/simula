/**
 * Purpose: Build the planner core-situation model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/planner/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import type { PlannerPromptBuilder } from "./contracts"

export const coreSituation: PlannerPromptBuilder = (current) =>
    `Planner coreSituation.
Summarize the scenario's factual situation, setting, triggering pressure, and end condition in one compact paragraph.
Do not introduce actors that are not implied by the scenario.
Return only the digest body. Do not include labels, headings, markdown, bullets, or prefixes.

${renderPromptBlock("SCENARIO", `Scenario: ${current.scenario.text}`)}`
