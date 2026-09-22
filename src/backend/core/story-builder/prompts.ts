/**
 * Purpose: Build Story Builder prompts and deterministic fallback text.
 * Pattern: Prompt builder.
 * Usage: Imported by the Story Builder graph and prompt contract tests.
 * Related: src/backend/core/story-builder/index.ts
 */
import type { StoryBuilderDraftRequest, StoryBuilderMessage } from "@/shared"
import { renderOutputLengthGuide } from "@/backend/core/prompts/prompt"

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

Cast: ${request.controls.numCast}
Max rounds: ${request.controls.maxRound ?? 8}
Additional cast: ${request.controls.allowAdditionalCast ? "yes" : "no"}
Actions per visibility: ${request.controls.actionsPerType}

Conversation:
${renderConversation(request.messages)}

Return only the draft. No code fences.`
}

export function renderStoryBuilderChangeSummaryPrompt(
  request: StoryBuilderDraftRequest,
  revisedDraft: string
): string {
  return `StoryBuilder change summary for Simula.
Explain what changed in the revised scenario draft.
Be concise and concrete. Mention only changes that are reflected in the revised draft.
Use a natural chat response, not a full scenario.

Latest user request:
${latestUserRequest(request.messages)}

Previous draft:
${latestAssistantDraft(request.messages)}

Revised draft:
${revisedDraft}

Return 2-4 short bullets or short sentences. Do not repeat the full draft.`
}

export function storyBuilderFallbackDraft(messages: StoryBuilderMessage[]): string {
  const userInput = latestUserRequest(messages) ||
    "A group faces a high-pressure decision with incomplete information."
  return [
    "# Scenario Draft",
    "",
    "## Purpose and End Condition",
    "- Start when the central pressure becomes visible to every key actor.",
    "- End when one practical course of action is chosen and the actors understand who carries the cost, authority, and public explanation.",
    "- The goal is to observe how incentives, responsibility, timing, and incomplete information shape the decision.",
    "",
    "## Core Situation",
    `- ${userInput}`,
    "- The situation is already under time pressure, but the decisive facts are incomplete or contested.",
    "- Each actor has a plausible reason to delay, redirect responsibility, or push for a narrower decision.",
    "",
    "## Key Actors",
    "- Primary decision maker: owns the final call and must balance speed, legitimacy, and visible accountability.",
    "- Operational lead: understands execution constraints and pushes for a practical path that can actually be carried out.",
    "- Risk controller: watches legal, financial, or safety exposure and slows the decision until responsibility is explicit.",
    "- Field or channel representative: carries outside pressure back into the room and fears being blamed for delay.",
    "- External stakeholder: reacts to ambiguity, delay, or visible failure and can change the public cost of the decision.",
    "",
    "## Channels",
    "- `public`: official statements, meeting minutes, announcements, press or stakeholder-facing updates",
    "- `private`: direct pressure, risk warnings, informal alignment, responsibility negotiation",
    "- `group`: working meetings, review sessions, cross-functional coordination, fact-check discussions",
    "",
    "## Immediate Action Units",
    "- Reframe the decision around a narrower condition or deadline.",
    "- Ask for missing evidence, revised numbers, or a risk memo before agreeing.",
    "- Push a conditional approval that moves responsibility to another actor.",
    "- Change public wording so the same decision carries less visible risk.",
    "- Escalate the issue to a higher authority when the current group cannot absorb the downside.",
    "",
    "## Behavioral Realism Rules",
    "- Actors should negotiate responsibility, timing, evidence, and public messaging through concrete moves.",
    "- No actor should know every fact at once or solve the conflict through a single perfect statement.",
    "- Progress should come from conditional decisions, tradeoffs, and responsibility allocation rather than long backstory.",
  ].join("\n")
}

export function latestAssistantDraft(messages: StoryBuilderMessage[]): string {
  return latestMessage(messages, "assistant")
}

export function storyBuilderFallbackSummary(request: StoryBuilderDraftRequest): string {
  const latestRequest = latestUserRequest(request.messages)
  return latestRequest ? `Reflected the latest request: ${latestRequest}` : "Updated the scenario draft."
}

function renderConversation(messages: StoryBuilderMessage[]): string {
  return messages
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
    .join("\n")
}

function latestUserRequest(messages: StoryBuilderMessage[]): string {
  return latestMessage(messages, "user")
}

function latestMessage(messages: StoryBuilderMessage[], role: StoryBuilderMessage["role"]): string {
  return messages
    .filter((message) => message.role === role)
    .map((message) => message.content.trim())
    .filter(Boolean)
    .at(-1) ?? ""
}
