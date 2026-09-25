/**
 * Purpose: Map builder machine fields, tasks, and statuses to localized UI labels.
 * Pattern: Presentation mapping.
 * Usage: Shared by the form, activity, and review panels.
 * Related: src/ui/i18n/messages/document-builder.ts
 */
import type { UiTexts } from "@/ui/types/i18n"

export function builderLabel(key: string, t: UiTexts): string {
  const labels: Record<string, string> = {
    sources: t.builderSourcesStage, situation: t.builderSituationStage, participants: t.builderParticipantsStage, review: t.builderReviewStage,
    evidence: t.builderEvidence, digest: t.builderDigest, facet: t.builderFacet, roster: t.builderRoster, participant: t.builderParticipantsStage, rules: t.builderRules, "source-access": t.builderSourceAccess, check: t.builderCheck,
    summary: t.builderSummary, content: t.analysisContent, title: t.scenario, purpose: t.builderPurpose, decision: t.builderDecision, setting: t.builderSetting,
    assumptions: t.builderAssumptions, gaps: t.builderGaps, personality: t.builderPersonality, authority: t.builderAuthority, goal: t.builderGoal,
    entries: t.builderEntries, claims: t.builderClaims, names: t.builderNames, issues: t.builderIssues,
    uploaded: t.builderStatusUploaded, processing: t.builderStatusProcessing, ready: t.builderStatusReady, partial: t.builderStatusPartial,
    failed: t.builderStatusFailed, canceled: t.builderStatusCanceled, waiting: t.builderStatusWaiting, running: t.builderStatusRunning, retrying: t.builderStatusRetrying, completed: t.builderStatusCompleted,
    goals: t.builderGoals, constraints: t.builderConstraints, tensions: t.builderTensions,
    information: t.builderInformation, actions: t.builderActions, termination: t.builderTermination, variation: t.builderVariation,
  }
  return labels[key] ?? t.builderSummary
}
