/**
 * Purpose: Expose the cohesive instruction set for this prompt family.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/simulation/outputs/analysis/conclusion.ts.
 * Related: src/backend/core/simulation/outputs/analysis/conclusion.ts, src/backend/core/prompts/blocks.ts
 */
import { instruction as implications } from "./implications"
import { instruction as observations } from "./observations"
import { instruction as source } from "./source"

export const conclusionInstructions = { source, observations, implications } as const
