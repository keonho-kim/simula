/**
 * Purpose: Define analytical subjects, evidence, sections, distributions, and resource scopes.
 * Pattern: Serializable analysis contract.
 * Usage: Shared by report workflows, persistence, API, and presentation.
 * Related: src/shared/analytical-report-schema.ts, src/shared/documents.ts
 */
import type { EvidenceBlock, SourceLocator } from "./documents"
import type { ModelMetrics } from "./run"

export const ANALYSIS_SECTIONS = ["strengths", "weaknesses", "opportunities", "threats", "trajectories", "actors", "materials", "scenario", "conclusion"] as const
export type AnalysisSectionId = typeof ANALYSIS_SECTIONS[number]
export type AnalysisSubject = { kind: "run" | "batch"; id: string }
export interface AnalysisReference {
  id: string
  category: "source_claim" | "scenario_assumption" | "user_constraint" | "simulation_observation" | "analytical_interpretation"
  text: string
  documentId?: string
  method?: EvidenceBlock["method"]
  sourceKind?: EvidenceBlock["kind"]
  locator?: SourceLocator
  runId?: string
  recordId?: string
  roundIndex?: number
}
export interface AnalysisPerspective { focus: string; objective: string; horizon: string; boundary: string; evidenceIds: string[] }
export interface AnalysisFinding { text: string; evidenceIds: string[]; provenance?: AnalysisReference["category"][] }
export interface AnalysisSection {
  id: AnalysisSectionId
  status: "ready" | "failed"
  summary: string
  content: string
  findings: AnalysisFinding[]
  evidenceIds: string[]
  score?: { value: number | null; rationale: string; evidenceIds: string[] }
}
export interface TrajectoryDistribution {
  categories: Array<{ id: string; label: string; description: string; worldIds: string[] }>
  unclassifiedWorldIds: string[]
}
export interface AnalysisCoverage { requested: number; completed: number; failed: number; canceled: number; interrupted: number; analyzed: number }
export interface AnalyticalReport {
  perspective: AnalysisPerspective
  coverage: AnalysisCoverage
  trajectories: TrajectoryDistribution
  sections: AnalysisSection[]
  evidenceIds: string[]
  unavailableInputs: string[]
}
export interface AnalysisRecord {
  id: string
  subject: AnalysisSubject
  usageAccountingVersion?: 1
  inputRevision: string
  language: "en" | "ko"
  fastMode: boolean
  createdAt: string
  maxCalls: number
  deadlineAt: string
  stopReason?: "user" | "deadline" | "call_budget"
  status: "running" | "ready" | "partial" | "failed" | "canceled"
  report?: AnalyticalReport
}

export type AnalysisLookup =
  | { analysis: null; freshness: null }
  | { analysis: AnalysisRecord; freshness: "current" | "outdated" | "unavailable" }

export type UsageMeasure = Pick<ModelMetrics, "durationMs" | "queueWaitMs" | "inputTokens" | "reasoningTokens" | "outputTokens" | "totalTokens" | "tokenSource">
export interface ResourceUsage {
  calls: number | null
  observedCalls: number
  durationMs: number | null
  queueWaitMs: number | null
  inputTokens: number | null
  reasoningTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
  unavailableTokenCalls: number
}
export interface ResourceAccounting {
  sharedPreparation: ResourceUsage | null
  worlds: Array<{ worldId: string; runId?: string; source: "run" | "preparation" | "unavailable"; usage: ResourceUsage }>
  worldsUnavailable: boolean
  worldTotal: ResourceUsage
  analysisGeneration: ResourceUsage
  overall: ResourceUsage
}

export interface AnalyticalExport {
  formatVersion: 2
  reportId: string
  subject: AnalysisSubject
  inputRevision: string
  acceptedDigest: string
  createdAt: string
  language: "en" | "ko"
  executionStatus: AnalysisRecord["status"]
  freshness: "current" | "outdated" | "unavailable"
  metricsScope: "analysis_generation"
  report: AnalyticalReport
  references: AnalysisReference[]
  metrics: Array<{ timestamp: string; metrics: ModelMetrics }>
  accounting: ResourceAccounting
}
