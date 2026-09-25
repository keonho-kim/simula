/**
 * Purpose: Select conversation messages and construct deterministic fallback drafts.
 * Pattern: Prompt builder.
 * Usage: Imported by the Story Builder graph and prompt contract tests.
 * Related: src/backend/core/story-builder/index.ts
 */
import type { StoryBuilderDraftRequest,StoryBuilderMessage } from "@/shared"


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

export function latestUserRequest(messages: StoryBuilderMessage[]): string {
  return latestMessage(messages, "user")
}

function latestMessage(messages: StoryBuilderMessage[], role: StoryBuilderMessage["role"]): string {
  return messages
    .filter((message) => message.role === role)
    .map((message) => message.content.trim())
    .filter(Boolean)
    .at(-1) ?? ""
}
