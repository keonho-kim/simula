/**
 * Purpose: Define the narrow streaming provider input and normalized usage contracts.
 * Pattern: Integration contract.
 * Usage: Shared by model construction and invocation adapters.
 * Related: src/backend/integrations/llm/model-factory.ts, src/backend/integrations/llm/stream.ts
 */
export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }

export type ChatInput = string | Array<{ role: "system" | "user"; content: string | ChatContentPart[] }>

export type StreamingChatModel = {
  stream(prompt: ChatInput, options?: { signal?: AbortSignal }): Promise<AsyncIterable<{ content: unknown; usage_metadata?: unknown }>>
}

export interface TokenUsage {
  inputTokens: number
  reasoningTokens: number
  outputTokens: number
  totalTokens: number
}
