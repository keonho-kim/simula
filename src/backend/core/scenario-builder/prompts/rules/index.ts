/**
 * Purpose: Expose the cohesive instruction set for this prompt family.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/scenario-builder/design.ts.
 * Related: src/backend/core/scenario-builder/design.ts, src/backend/core/prompts/blocks.ts
 */
import { instruction as actions } from "./actions"
import { instruction as information } from "./information"
import { instruction as termination } from "./termination"
import { instruction as variation } from "./variation"

export const ruleInstructions = { information, actions, termination, variation } as const
