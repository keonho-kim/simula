/**
 * Purpose: Build the coordinator runtime-frame model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/coordinator/prompts/contracts.ts
 */
import { renderPromptBlock } from "@/backend/core/prompts/blocks"
import { compactPlannerDigest, renderOutputLengthGuide, scalePromptLimit } from "@/backend/core/prompts/prompt"
import { renderWorldConstraints } from "@/backend/core/simulation/planning/world-constraints"
import type { CoordinatorPromptBuilder } from "./contracts"

export const runtimeFrame: CoordinatorPromptBuilder = (current) =>
    `Coordinator runtimeFrame. Return 2 short sentences on communication structure, timing pressure, and interaction chain.
${renderOutputLengthGuide(current.scenario.controls, "coordinator frame")}
${renderPromptBlock("CONSTRAINTS", current.scenario.world ? renderWorldConstraints(current.scenario.world) : undefined)}

${renderPromptBlock("SCENARIO", `Digest:
${compactPlannerDigest(current.simulation.plan, current.scenario.text, scalePromptLimit(900, current.scenario.controls))}`)}`
