/**
 * Purpose: Describe one world's initial scene and immutable confirmed cast.
 * Pattern: Shared artifact contract.
 * Usage: Passed from world StoryBuilder into simulation initialization.
 * Related: src/shared/participants.ts, src/shared/scenario.ts
 */
import type { ScenarioParticipant } from "./participants"
import type { KnownSourceFact } from "./scenario-builder"

export interface WorldOpening {
  setting: string
  summary: string
  assumptions: string[]
  evidenceIds: string[]
}

export interface WorldParticipant extends ScenarioParticipant {
  initialPosition: string
  privateConcern: string
  startingAssumptions: string[]
  knownSourceFacts: KnownSourceFact[]
}

export interface WorldStory {
  id: string
  sourceScenarioId: string
  sourceScenarioVersion: number
  documentSetId: string
  documentRevision: number
  opening: WorldOpening
  participants: WorldParticipant[]
  agenda: string[]
  informationFlow: string[]
  constraints: string[]
  actionScope: string[]
  endConditions: string[]
  allowedVariation: string[]
  assumptions: string[]
}
