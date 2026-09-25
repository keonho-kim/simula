/**
 * Purpose: Keep report and branch graph state limited to identities and accepted artifact references.
 * Pattern: LangGraph state annotations.
 * Usage: Used by analytical report and independent section graphs.
 * Related: src/backend/core/simulation/outputs/analysis/graph.ts, src/backend/core/simulation/outputs/analysis/branch.ts
 */
import { Annotation } from "@langchain/langgraph"

export const AnalysisState = Annotation.Root({ reportId: Annotation<string>(), perspectiveRef: Annotation<string>(), sectionRefs: Annotation<string[]>() })
export const AnalysisBranchState = Annotation.Root({ sectionId: Annotation<string>(), findingsRef: Annotation<string>(), scoreRef: Annotation<string>(), detailRef: Annotation<string>() })
