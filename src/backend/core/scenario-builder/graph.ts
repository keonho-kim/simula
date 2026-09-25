/**
 * Purpose: Construct one shared document-grounded scenario through bounded stages.
 * Pattern: LangGraph workflow with injected artifact and model boundaries.
 * Usage: Called by scenario-builder runtime once before any world StoryBuilder starts.
 * Related: src/backend/core/scenario-builder/state.ts, src/backend/core/generation/tasks.ts
 */
import { END, START, StateGraph } from "@langchain/langgraph"
import type { BuilderRequest, ScenarioSpecification } from "@/shared/scenario-builder"
import { assembleScenario, scheduleScenarioRepairs } from "./assembly"
import { buildFacets, buildParticipants, buildRules, buildSituation } from "./design"
import { buildEvidenceDigest } from "./evidence"
import { buildSourceAccess } from "./source-access"
import { initialBuilderState, ScenarioBuilderState } from "./state"
import { createGenerationTasks } from "@/backend/core/generation/tasks"
import type { BuilderDependencies } from "./contracts"

export async function buildScenario(buildId: string, request: BuilderRequest, documentIds: readonly string[], dependencies: BuilderDependencies): Promise<ScenarioSpecification> {
  if (!documentIds.length || documentIds.length > 20 || new Set(documentIds).size !== documentIds.length) {
    throw new Error("Scenario construction requires one to twenty distinct extracted documents.")
  }
  const tasks = createGenerationTasks(request, dependencies)
  const graph = new StateGraph(ScenarioBuilderState)
    .addNode("evidence", async state => ({ digestRef: await buildEvidenceDigest(tasks, state.documentIds, dependencies.readEvidence) }))
    .addNode("facets", async state => ({ facetRefs: await buildFacets(tasks, state.digestRef) }))
    .addNode("situation", async state => ({ situationRef: await buildSituation(tasks, state.digestRef, state.facetRefs) }))
    .addNode("participants", async state => ({ participantRefs: await buildParticipants(tasks, state.situationRef) }))
    .addNode("rules", async state => ({ ruleRefs: await buildRules(tasks, state.situationRef, state.participantRefs) }))
    .addNode("source-access", async state => ({ sourceAccessRef: await buildSourceAccess(tasks, state.digestRef, state.participantRefs, "rule-information") }))
    .addEdge(START, "evidence").addEdge("evidence", "facets").addEdge("facets", "situation")
    .addEdge("situation", "participants").addEdge("participants", "rules")
    .addEdge("rules", "source-access").addEdge("source-access", END)
    .compile()
  let state = await graph.invoke(initialBuilderState(buildId, documentIds), { signal: dependencies.signal })
  // One bounded repair pass regenerates affected units; unchanged siblings reuse accepted artifacts.
  if (await scheduleScenarioRepairs(tasks, state)) {
    state = await graph.invoke(initialBuilderState(buildId, documentIds), { signal: dependencies.signal })
  }
  dependencies.signal.throwIfAborted()
  return assembleScenario(tasks, state)
}
