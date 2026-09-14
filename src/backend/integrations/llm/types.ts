export type ChatInput = string | Array<{ role: "system" | "user"; content: string }>

export type StreamingChatModel = {
  stream(prompt: ChatInput): Promise<AsyncIterable<{ content: unknown; usage_metadata?: unknown }>>
}

export interface TokenUsage {
  inputTokens: number
  reasoningTokens: number
  outputTokens: number
  totalTokens: number
}
