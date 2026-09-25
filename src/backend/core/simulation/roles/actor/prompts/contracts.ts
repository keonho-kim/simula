/**
 * Purpose: Define the role prompt builder contract.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/actor/prompts/index.ts
 */
import type { ActorStepInput } from "@/backend/core/simulation/roles/actor/state"
import type { ActorTraceStep } from "@/shared"

export type ActorPromptBuilder = (
  state: ActorStepInput,
  partial: Partial<Record<ActorTraceStep, string>>
) => string

export type ActorPromptStep = Exclude<ActorTraceStep, "context">
