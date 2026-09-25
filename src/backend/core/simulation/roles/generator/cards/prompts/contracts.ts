/**
 * Purpose: Define the role prompt builder contract.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/generator/cards/prompts/index.ts
 */
import type { ActorCardStepInput } from "@/backend/core/simulation/roles/generator/cards/state"

export type ActorCardPromptBuilder = (state: ActorCardStepInput) => string
