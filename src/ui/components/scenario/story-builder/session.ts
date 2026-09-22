/**
 * Purpose: Persist the current story-builder draft session in browser storage.
 * Pattern: Storage adapter.
 * Usage: Called by story-builder-dialog.tsx when authored state changes.
 * Related: src/ui/storage/run-session.ts
 */
import type { ScenarioControls, StoryBuilderMessage } from "@/shared"

const STORY_BUILDER_SESSION_KEY = "simula.story-builder.session"

interface StoryBuilderSession {
  id: string
  step: "setup" | "refine"
  idea: string
  draft: string
  messages: StoryBuilderMessage[]
  controls: ScenarioControls
}

export function writeStoryBuilderSession(session: StoryBuilderSession): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(
    STORY_BUILDER_SESSION_KEY,
    JSON.stringify({ ...session, updatedAt: new Date().toISOString() })
  )
}

export function clearStoryBuilderSession(): void {
  if (typeof localStorage === "undefined") return
  localStorage.removeItem(STORY_BUILDER_SESSION_KEY)
}
