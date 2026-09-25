/**
 * Purpose: Hold only bounded execution identities and accepted artifact references.
 * Pattern: LangGraph state annotation.
 * Usage: Instantiated by the shared scenario-builder graph.
 * Related: src/backend/core/scenario-builder/graph.ts
 */
import { Annotation } from "@langchain/langgraph"

export const ScenarioBuilderState = Annotation.Root({
  buildId: Annotation<string>(),
  documentIds: Annotation<string[]>(),
  digestRef: Annotation<string>(),
  facetRefs: Annotation<string[]>(),
  situationRef: Annotation<string>(),
  participantRefs: Annotation<string[]>(),
  ruleRefs: Annotation<string[]>(),
  sourceAccessRef: Annotation<string>(),
})

export type ScenarioBuilderGraphState = typeof ScenarioBuilderState.State

export function initialBuilderState(buildId: string, documentIds: readonly string[]): ScenarioBuilderGraphState {
  return { buildId, documentIds: [...documentIds], digestRef: "", facetRefs: [], situationRef: "", participantRefs: [], ruleRefs: [], sourceAccessRef: "" }
}
