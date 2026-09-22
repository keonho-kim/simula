/**
 * Purpose: Reduce story-builder stream events into stable chat presentation state.
 * Pattern: Reducer.
 * Usage: Called by story-builder-dialog.tsx for every stream event.
 * Related: src/shared/api.ts, src/ui/components/scenario/story-builder/panels.tsx
 */
import type { StoryBuilderStreamEvent } from "@/shared"
import type { UiTexts } from "@/ui/types/i18n"

export type StoryBuilderChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; kind: "summary" }
  | { role: "progress"; content: string; pending: boolean }

export function initialProgressMessage(t: UiTexts): StoryBuilderChatMessage {
  return { role: "progress", content: t.storyBuilderGenerating, pending: true }
}

export function applyStoryBuilderStreamEvent(
  messages: StoryBuilderChatMessage[],
  event: StoryBuilderStreamEvent,
  t: UiTexts
): StoryBuilderChatMessage[] {
  if (event.type === "progress") {
    const content = event.stage === "summary"
      ? event.status === "started" ? t.storyBuilderSummarizing : t.storyBuilderSummaryReady
      : event.status === "started" ? t.storyBuilderGenerating : t.storyBuilderDraftReady
    return updateProgressMessage(messages, content, event.status === "started")
  }
  if (event.type === "summary_delta") {
    return updateSummaryMessage(messages, event.content, true)
  }
  if (event.type === "summary") {
    return updateSummaryMessage(messages, event.content, false)
  }
  return messages
}

export function finishProgressMessage(
  messages: StoryBuilderChatMessage[],
  t: UiTexts
): StoryBuilderChatMessage[] {
  return updateProgressMessage(messages, t.storyBuilderDraftReady, false)
}

function updateProgressMessage(
  messages: StoryBuilderChatMessage[],
  content: string,
  pending: boolean
): StoryBuilderChatMessage[] {
  const index = messages.findLastIndex((message) => message.role === "progress")
  if (index < 0) return [...messages, { role: "progress", content, pending }]
  return messages.map((message, messageIndex) =>
    messageIndex === index ? { role: "progress", content, pending } : message
  )
}

function updateSummaryMessage(
  messages: StoryBuilderChatMessage[],
  content: string,
  append: boolean
): StoryBuilderChatMessage[] {
  const last = messages.at(-1)
  if (last?.role !== "assistant" || last.kind !== "summary") {
    return [...messages, { role: "assistant", content, kind: "summary" }]
  }
  return [
    ...messages.slice(0, -1),
    { role: "assistant", content: append ? `${last.content}${content}` : content, kind: "summary" },
  ]
}
