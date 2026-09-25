/**
 * Purpose: Build the observer round-summary model request.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/observer/prompts/contracts.ts
 */
import { renderPromptBlocks } from "@/backend/core/prompts/blocks"
import { observerPromptContext } from "./context"
import type { ObserverPromptBuilder } from "./contracts"

export const roundSummary: ObserverPromptBuilder = (current) => {
    const context = observerPromptContext(current)
    return `Observer roundSummary.
Return no more than 5 sentences.
Summarize the round's essential outcome for a report reader, including actor reactions, notable interactions, and relationship movement only when supported by recorded interactions.
No headings, markdown, bullets, JSON, labels, or meta commentary.

${renderPromptBlocks(context)}`
  }
