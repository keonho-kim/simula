import type {
  LLMSettings,
  StoryBuilderDraftRequest,
  StoryBuilderDraftResponse,
  StoryBuilderMessage,
} from "@simula/shared"
import { invokeRoleText } from "../llm"
import { withPromptLanguageGuide } from "../language"
import { validateRoleSettings } from "../settings"

export async function draftScenario(
  request: StoryBuilderDraftRequest,
  settings: LLMSettings
): Promise<StoryBuilderDraftResponse> {
  validateRoleSettings(settings, "storyBuilder")
  const prompt = withPromptLanguageGuide(renderStoryBuilderPrompt(request), request.language)
  const generated = await invokeRoleText(settings, "storyBuilder", prompt)
  return { text: generated || fallbackDraft(request.messages) }
}

function renderStoryBuilderPrompt(request: StoryBuilderDraftRequest): string {
  return `You are StoryBuilder for Simula, an actor-based virtual simulation system.
Create a compact simulation-ready scenario draft as markdown/plain text.
The scenario must describe the purpose, end condition, core situation, actor pressure, and likely interaction dynamics.
Write concrete actor-driven material. Avoid generic creative-writing advice.
Requested cast size: ${request.controls.numCast}.
Requested max rounds: ${request.controls.maxRound ?? 8}.
Allow additional cast: ${request.controls.allowAdditionalCast ? "true" : "false"}.
Actions per visibility type: ${request.controls.actionsPerType}.

Conversation:
${renderConversation(request.messages)}

Return only the scenario draft. Do not wrap it in code fences.`
}

function renderConversation(messages: StoryBuilderMessage[]): string {
  return messages
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
    .join("\n")
}

function fallbackDraft(messages: StoryBuilderMessage[]): string {
  const userInput =
    messages
      .filter((message) => message.role === "user")
      .map((message) => message.content.trim())
      .filter(Boolean)
      .at(-1) ?? "A group faces a high-pressure decision with incomplete information."

  return [
    "# Scenario Draft",
    "",
    "## Purpose and End Condition",
    "- Start when the central pressure becomes visible to all key actors.",
    "- End when one practical course of action is chosen and the actors understand who carries the cost.",
    "",
    "## Core Situation",
    userInput,
    "",
    "## Key Actors",
    "- Primary decision maker: owns the final call but is exposed to reputational and operational risk.",
    "- Operational lead: understands execution constraints and pushes for a practical path.",
    "- Financial or legal controller: slows the decision until responsibility and downside are clear.",
    "- External stakeholder: reacts to delay, ambiguity, or visible failure.",
    "",
    "## Interaction Pressure",
    "- Actors should negotiate responsibility, timing, evidence, and public messaging.",
    "- Progress should happen through concrete decisions rather than long backstory.",
  ].join("\n")
}
