/**
 * Purpose: Read provider finish and reasoning metadata without exposing provider objects.
 * Pattern: Pure adapter functions.
 * Usage: Called by the bounded model stream collector.
 * Related: src/backend/integrations/llm/stream.ts
 */
export function readReasoningContent(chunk: unknown): string {
  const candidates = [
    getPath(chunk, ["reasoning_content"]),
    getPath(chunk, ["additional_kwargs", "reasoning_content"]),
    getPath(chunk, ["response_metadata", "reasoning_content"]),
    getPath(chunk, ["kwargs", "additional_kwargs", "reasoning_content"]),
    readReasoningContentBlock(getPath(chunk, ["content"])),
  ]
  // Providers can repeat the same reasoning in several metadata locations.
  return [...new Set(candidates.filter((value): value is string => typeof value === "string" && !!value))].join("")
}

export function readFinishReason(chunk: unknown): string | undefined {
  const candidates = [
    getPath(chunk, ["finish_reason"]),
    getPath(chunk, ["response_metadata", "finish_reason"]),
    getPath(chunk, ["response_metadata", "finishReason"]),
    getPath(chunk, ["response_metadata", "stop_reason"]),
    getPath(chunk, ["generation_info", "finish_reason"]),
  ]
  return candidates.find((value): value is string => typeof value === "string")
}

function readReasoningContentBlock(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined
  return content.map((part) => {
    if (typeof part !== "object" || part === null) return ""
    const record = part as Record<string, unknown>
    if (record.type === "reasoning_content") {
      return typeof record.reasoningText === "string" ? record.reasoningText
        : typeof record.text === "string" ? record.text : ""
    }
    return record.type === "reasoning" && typeof record.text === "string" ? record.text : ""
  }).join("")
}

function getPath(value: unknown, path: string[]): unknown {
  let current = value
  for (const key of path) {
    if (typeof current !== "object" || current === null || !(key in current)) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}
