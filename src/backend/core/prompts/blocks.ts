/**
 * Purpose: Format explicitly classified input data as flat, program-owned prompt blocks.
 * Pattern: Pure formatting module.
 * Usage: Used by role prompt builders and bounded structured generation.
 * Related: src/backend/core/generation/prompts/structured-task.ts
 */
export type PromptBlockName = "INFO" | "SOURCE" | "USER_INPUT" | "SCENARIO" | "SIMULATION" | "ACTOR" | "HISTORY"
  | "OPTIONS" | "PREVIOUS_RESULT" | "REVIEW_TARGET" | "ANALYSIS" | "CONSTRAINTS" | "FEEDBACK" | "PREVIOUS_STATE" | "CURRENT_STATE"
export type PromptBlocks = Partial<Record<PromptBlockName, unknown>>

export function renderPromptBlock(name: PromptBlockName, value: unknown): string {
  if (value === undefined) return ""
  const body = typeof value === "string"
    ? value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    : JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e")
  return `<${name}>\n${body}\n</${name}>`
}

export function renderPromptBlocks(blocks: PromptBlocks): string {
  return (Object.keys(blocks) as PromptBlockName[]).map(name => renderPromptBlock(name, blocks[name])).filter(Boolean).join("\n\n")
}
