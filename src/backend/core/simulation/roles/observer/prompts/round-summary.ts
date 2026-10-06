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
Lead with what changed or remained unresolved. Name the relevant actors and connect their recorded actions to the outcome. Distinguish a proposal, a commitment, and execution; preserve disagreement and missing confirmation. If nothing materially changed, say so without inventing progress. Do not infer private knowledge or numerical certainty.
No headings, markdown, bullets, JSON, labels, or meta commentary.

${renderPromptBlocks(context)}`
  }
