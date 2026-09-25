/**
 * Purpose: Select the prompt builder for each role workflow step.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/generator/cards/graph.ts
 */
import type { ActorCardStep } from "@/shared"
import { backgroundHistory } from "./background-history"
import type { ActorCardPromptBuilder } from "./contracts"
import { personality } from "./personality"
import { preference } from "./preference"
import { role } from "./role"
export type { ActorCardPromptBuilder } from "./contracts"

export const actorCardPrompts: Record<ActorCardStep, ActorCardPromptBuilder> = {
  role,
  backgroundHistory,
  personality,
  preference,
}
