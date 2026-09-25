/**
 * Purpose: Build one scenario draft or revision request.
 * Pattern: Simple Module.
 * Usage: Imported by the owning workflow.
 * Related: src/backend/core/story-builder/prompts/draft.ts
 */
import { renderPromptBlocks } from "@/backend/core/prompts/blocks"
import { renderOutputLengthGuide } from "@/backend/core/prompts/prompt"
import type { StoryBuilderDraftRequest } from "@/shared"

export function renderStoryBuilderPrompt(request: StoryBuilderDraftRequest): string {
  return `StoryBuilder for Simula.
Draft or revise one simulation scenario in the same structure as Simula sample scenario files.
${renderOutputLengthGuide(request.controls, "scenario draft")}
The draft must be concrete, actor-driven, and ready to pass into the simulation preview.

Required markdown structure:
- One scenario title.
- "## Purpose and End Condition"
- "## Core Situation"
- "## Key Actors"
- "## Channels"
- "## Immediate Action Units"
- "## Behavioral Realism Rules"

Content requirements:
- Key Actors must include concrete named or role-specific actors with pressure, authority, incentives, and likely behavior.
- Channels must define public, private, and group communication surfaces.
- Immediate Action Units must list practical actions actors can take during rounds.
- Behavioral Realism Rules must prevent magical knowledge, instant consensus, and purely dramatic one-step solutions.
- Do not include YAML frontmatter. The app keeps controls separately.
- Do not use code fences.

${renderPromptBlocks({
  CONSTRAINTS: request.controls,
  USER_INPUT: request.messages.flatMap((message, index) => message.role === "user" ? [{ index, content: message.content }] : []),
  PREVIOUS_RESULT: request.messages.flatMap((message, index) => message.role === "assistant" ? [{ index, content: message.content }] : []),
})}
Conversation entries preserve their original index; revise the latest draft according to subsequent user requests.

Return only the draft. No code fences.`
}
