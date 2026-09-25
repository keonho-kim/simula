/**
 * Purpose: Define report input references and the narrow model/artifact contracts supplied by runtime.
 * Pattern: Consumer-owned workflow contracts.
 * Usage: Shared by analytical evidence, branch graphs, and runtime composition.
 * Related: src/backend/core/simulation/outputs/analysis/graph.ts, src/backend/core/generation/tasks.ts
 */
import type { z } from "zod"
import type { AnalysisReference, AnalysisSubject } from "@/shared/analytical-report"
import type { EvidenceBlock } from "@/shared/documents"
import type { GenerationDependencies, GenerationTasks } from "@/backend/core/generation/tasks"
import type { analyticalSummarySchema } from "@/shared/analytical-report-schema"

export interface AnalysisWorld { id: string; runId?: string; status: "completed" | "failed" | "canceled" | "interrupted" }
export interface AnalysisInput {
  subject: AnalysisSubject
  language: "en" | "ko"
  fastMode: boolean
  scenarioText: string
  scenarioCategory: "user_constraint" | "scenario_assumption"
  worlds: AnalysisWorld[]
  documentIds: string[]
}
export interface AnalysisDependencies extends GenerationDependencies {
  readWorld: (runId: string) => Promise<unknown>
  readDocument: (documentId: string) => Promise<EvidenceBlock[]>
  saveReference: (reference: AnalysisReference) => Promise<void>
  readReference: (referenceId: string) => Promise<AnalysisReference | undefined>
}
export type AnalysisTasks = GenerationTasks<{ language: "en" | "ko"; fastMode: boolean }>
export type EvidenceSummary = z.infer<typeof analyticalSummarySchema>
export interface WorldSummary { world: AnalysisWorld; summary: EvidenceSummary; observationIds: string[] }
