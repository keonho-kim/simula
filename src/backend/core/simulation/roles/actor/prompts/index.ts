/**
 * Purpose: Select the prompt builder for each role workflow step.
 * Pattern: Simple Module.
 * Usage: Consumed by the owning role workflow.
 * Related: src/backend/core/simulation/roles/actor/graph.ts
 */
import { action } from "./action"
import type { ActorPromptBuilder, ActorPromptStep } from "./contracts"
import { intent } from "./intent"
import { message } from "./message"
import { target } from "./target"
import { thought } from "./thought"
export type { ActorPromptBuilder,ActorPromptStep } from "./contracts"

export const actorPrompts: Record<ActorPromptStep, ActorPromptBuilder> = {
  thought,
  target,
  action,
  intent,
  message,
}
