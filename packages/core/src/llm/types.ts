export type StreamingChatModel = {
  stream(prompt: string): Promise<AsyncIterable<{ content: unknown; usage_metadata?: unknown }>>
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

