/**
 * Purpose: Explain changes between accepted and revised scenario drafts.
 * Pattern: Simple Module.
 * Usage: Imported by the owning workflow.
 * Related: src/backend/core/story-builder/prompts/draft.ts
 */
import { renderPromptBlocks } from "@/backend/core/prompts/blocks"
import type { StoryBuilderDraftRequest } from "@/shared"
import { latestAssistantDraft, latestUserRequest } from "../conversation"
export function renderStoryBuilderChangeSummaryPrompt(
  request: StoryBuilderDraftRequest,
  revisedDraft: string
): string {
  return `StoryBuilder change summary for Simula.
Explain what changed in the revised scenario draft.
Be concise and concrete. Mention only changes that are reflected in the revised draft.
Use a natural chat response, not a full scenario.

${renderPromptBlocks({ USER_INPUT: latestUserRequest(request.messages),
  PREVIOUS_RESULT: latestAssistantDraft(request.messages), SCENARIO: revisedDraft })}

Return 2-4 short bullets or short sentences. Do not repeat the full draft.`
}
