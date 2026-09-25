/**
 * Purpose: Build a bounded memory compression request from actor-visible records.
 * Pattern: Simple Module.
 * Usage: Called by the actor memory lifecycle before model invocation.
 * Related: src/backend/core/simulation/actors/memory.ts
 */
import type { ActorState, ScenarioControls } from "@/shared"
import { renderPromptBlocks } from "@/backend/core/prompts/blocks"
import { compactLines, compactText, scalePromptLimit } from "@/backend/core/prompts/prompt"

const CONTEXT_COMPRESSION_INPUT_CHARS = 700

export function compressMemory(actor: ActorState, context: string, controls: ScenarioControls, lengthGuide: string): string {
  return `Compress memory for the actor below. ${lengthGuide}
Keep only actionable facts, pressure, commitment, and important promises.

${renderPromptBlocks({
  SOURCE: { initiallyKnownFacts: actor.knownSourceFacts ?? [] },
  ACTOR: { name: actor.name, role: actor.role, personality: compactText(actor.personality, scalePromptLimit(100, controls)), preference: compactText(actor.preference, scalePromptLimit(120, controls)) },
  PREVIOUS_RESULT: compactText(actor.contextSummary || "None", scalePromptLimit(220, controls)),
  HISTORY: context ? compactLines(context.split("\n"), 8, scalePromptLimit(CONTEXT_COMPRESSION_INPUT_CHARS, controls)) : "No visible runtime history yet.",
})}`
}
