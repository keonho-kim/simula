/**
 * Purpose: Define the rule model instruction.
 * Pattern: Prompt definition.
 * Usage: Imported by src/backend/core/scenario-builder/design.ts.
 * Related: src/backend/core/scenario-builder/design.ts, src/backend/core/prompts/blocks.ts
 */
import { ruleInstructions as RULE_INSTRUCTIONS } from "./rules"
export function ruleInstructions(rule: keyof typeof RULE_INSTRUCTIONS): string {
  return `Write exactly one concise rule for this category. Do not return a list or alternatives. ${RULE_INSTRUCTIONS[rule]}`
}
