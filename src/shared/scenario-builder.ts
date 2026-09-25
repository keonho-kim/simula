/**
 * Purpose: Define shared document-grounded scenario drafts and task progress.
 * Pattern: Serializable contracts.
 * Usage: Consumed by scenario construction, persistence, and its API clients.
 * Related: src/backend/core/scenario-builder/contracts.ts
 */
import type { PromptLanguage } from "./scenario"
import type { ScenarioParticipant } from "./participants"

export const SITUATION_PRESETS = ["auto", "meeting", "presentation", "negotiation", "review"] as const
export type SituationPreset = typeof SITUATION_PRESETS[number]

export interface BuilderRequest {
  documentSetId: string
  documentRevision: number
  context: string
  situation: SituationPreset
  language: PromptLanguage
  fastMode: boolean
  participants: Array<{ name: string; personality?: string }>
}

export interface GroundedSummary {
  summary: string
  claims: Array<{ text: string; evidenceIds: string[] }>
  gaps: string[]
}

export interface ScenarioFacet {
  summary: string
  assumptions: string[]
  evidenceIds: string[]
}

export interface ScenarioSituation {
  title: string
  purpose: string
  decision: string
  setting: string
  assumptions: string[]
  evidenceIds: string[]
}

export interface ScenarioRules {
  entries: string[]
  assumptions: string[]
  evidenceIds: string[]
}

export type SourceFactAudience = { kind: "public" } | { kind: "participants"; participantIds: string[] } | { kind: "unresolved" }
export interface SourceFactAccess {
  id: string
  text: string
  evidenceIds: string[]
  audience: SourceFactAudience
}
export type KnownSourceFact = Omit<SourceFactAccess, "audience">

export interface ScenarioBuildIssue { scope: string; description: string; blocking: boolean }

export interface ScenarioSpecification {
  id: string
  version: number
  status: "review" | "blocked" | "confirmed"
  documentSetId: string
  documentRevision: number
  language: PromptLanguage
  situation: ScenarioSituation
  facets: Record<"goals" | "constraints" | "tensions", ScenarioFacet>
  participants: ScenarioParticipant[]
  rules: Record<"information" | "actions" | "termination" | "variation", ScenarioRules>
  sourceFacts: SourceFactAccess[]
  sourceEvidenceIds: string[]
  issues: ScenarioBuildIssue[]
}

export interface ScenarioBuildRecord {
  id: string
  request: BuilderRequest
  usageAccountingVersion?: 1
  status: "running" | "review" | "blocked" | "confirmed" | "failed" | "canceled"
  createdAt: string
  issue?: string
  specification?: ScenarioSpecification
}
