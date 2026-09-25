/**
 * Purpose: Read program-owned context blocks for deterministic test providers and assertions.
 * Pattern: Test-only prompt fixture reader.
 * Usage: Imported by test providers and prompt contract tests; never parses model output.
 * Related: src/backend/core/prompts/blocks.ts, src/backend/integrations/llm/testing/scenario-builder-response.ts
 */
export function testPromptBlock(prompt: string, name: string): unknown {
  const body = prompt.match(new RegExp(`<${name}>\\n([\\s\\S]*?)\\n</${name}>`))?.[1]
  if (body === undefined) return undefined
  try { return JSON.parse(body) }
  catch { return body.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&") }
}

export function testPromptInput(prompt: string): Record<string, unknown> {
  const merged: Record<string, unknown> = {}
  for (const match of prompt.matchAll(/<([A-Z_]+)>\n/g)) {
    if (match[1] === "FEEDBACK") continue
    const value = testPromptBlock(prompt, match[1])
    if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(merged, value)
  }
  return merged
}
