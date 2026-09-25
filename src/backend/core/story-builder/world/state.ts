/**
 * Purpose: Keep world StoryBuilder execution state limited to IDs and artifact references.
 * Pattern: LangGraph state annotation.
 * Usage: Used only by the per-world initialization graph.
 * Related: src/backend/core/story-builder/world/graph.ts
 */
import { Annotation } from "@langchain/langgraph"
import type { ScenarioSpecification } from "@/shared/scenario-builder"
import type { GenerationTasks } from "@/backend/core/generation/tasks"

export interface WorldStoryRequest { worldId: string; specification: ScenarioSpecification; language: "en" | "ko"; fastMode: boolean }
export type WorldTasks = GenerationTasks<WorldStoryRequest>
export interface WorldParticipantRefs { participantId: string; publicRef: string; concernRef: string }

export const WorldStoryState = Annotation.Root({
  worldId: Annotation<string>(),
  openingRef: Annotation<string>(),
  participantRefs: Annotation<WorldParticipantRefs[]>(),
  agendaRef: Annotation<string>(),
  informationRef: Annotation<string>(),
})
export type WorldGraphState = typeof WorldStoryState.State

export function initialWorldState(worldId: string): WorldGraphState {
  return { worldId, openingRef: "", participantRefs: [], agendaRef: "", informationRef: "" }
}
