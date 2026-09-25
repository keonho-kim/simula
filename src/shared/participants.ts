/**
 * Purpose: Define a confirmed participant identity and its shared profile constraints.
 * Pattern: Shared domain contract.
 * Usage: Used by scenario specifications and independent world initial states.
 * Related: src/shared/scenario-builder.ts, src/shared/world-story.ts
 */
export interface ScenarioParticipant {
  id: string
  name: string
  personality: string
  authority: string
  goal: string
  nameLocked: boolean
  personalityLocked: boolean
  evidenceIds: string[]
}
