/**
 * Purpose: Build the provider message contract for already validated finite choices.
 * Pattern: Prompt builder.
 * Usage: Called after exactChoiceOutputs at the LLM invocation boundary.
 * Related: src/backend/integrations/llm/invoke.ts
 */
import type { ChatInput } from "../types"
import { renderPromptBlock } from "@/backend/core/prompts/blocks"

export function exactChoiceMessages(prompt: string, outputs: string[]): ChatInput {
  return [
    {
      role: "system",
      content:
        "You are an exact-choice classifier. Do not reason. Answer immediately in assistant content with exactly one allowed output. No markdown, labels, punctuation, or explanation.",
    },
    {
      role: "user",
      content: `${prompt}

${renderPromptBlock("OPTIONS", `Allowed outputs:\n${outputs.map(output => `- ${output}`).join("\n")}`)}

Return exactly one allowed output in assistant content.`,
    },
  ]
}
