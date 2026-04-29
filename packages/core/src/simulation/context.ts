import type { ActorContextMemory, ActorState, Interaction, LLMSettings, RoundDigest, RunEvent, ScenarioControls, ScenarioInput } from "@simula/shared"
import { invokeRoleTextWithMetrics } from "../llm"
import { withPromptLanguageGuide } from "../language"
import { compactLines, compactText, renderOutputLengthGuide, scalePromptLimit } from "../prompt"
import { DEFAULT_ACTOR_CONTEXT_TOKEN_BUDGET, MAX_ACTOR_CONTEXT_TOKEN_BUDGET } from "../settings"

const MAX_CONTEXT_COMPRESSION_ATTEMPTS = 5
const ACTOR_MEMORY_PROMPT_CHARS = 240
const ACTOR_RECENT_CONTEXT_CHARS = 360
const CONTEXT_COMPRESSION_INPUT_CHARS = 520
const CONTEXT_SUMMARY_CHARS = 520
const CONTEXT_EVENT_CHARS = 280

export function emptyActorContext(): ActorContextMemory {
  return {
    public: [],
    semiPublic: {},
    private: {},
    solitary: [],
  }
}

export function contextUsedByActor(actor: ActorState): string[] {
  return [
    actor.contextSummary ? `summary: ${actor.contextSummary}` : "",
    ...actor.context.public,
    ...Object.values(actor.context.semiPublic).flat(),
    ...Object.values(actor.context.private).flat(),
    ...actor.context.solitary,
  ].filter(Boolean).slice(-12)
}

export function actorPromptContext(actor: ActorState, controls?: ScenarioControls): string {
  const recent = [
    ...actor.context.public.map((entry) => `public: ${entry}`),
    ...Object.values(actor.context.semiPublic).flat().map((entry) => `semi-public/private participant only: ${entry}`),
    ...Object.values(actor.context.private).flat().map((entry) => `private participant only: ${entry}`),
    ...actor.context.solitary.map((entry) => `solitary: ${entry}`),
  ].slice(-6)
  const recentContext = recent.length ? recent.join("\n") : "No runtime context yet."
  return actor.contextSummary
    ? `Memory: ${compactText(actor.contextSummary, scalePromptLimit(ACTOR_MEMORY_PROMPT_CHARS, controls))}
Recent context:
${compactLines(recentContext.split("\n"), 4, scalePromptLimit(ACTOR_RECENT_CONTEXT_CHARS, controls))}`
    : `Recent context:
${compactLines(recentContext.split("\n"), 4, scalePromptLimit(ACTOR_RECENT_CONTEXT_CHARS, controls))}`
}

export function resolveActorContextTokenBudget(scenario: ScenarioInput, settings: LLMSettings): number {
  const budget = scenario.controls.actorContextTokenBudget ?? settings.roles.actor.contextTokenBudget ?? DEFAULT_ACTOR_CONTEXT_TOKEN_BUDGET
  return Math.min(budget, MAX_ACTOR_CONTEXT_TOKEN_BUDGET)
}

export async function compressActorContext(
  actor: ActorState,
  input: {
    runId: string
    scenario: ScenarioInput
    settings: LLMSettings
    roundIndex: number
    tokenBudget: number
    emit: (event: RunEvent) => Promise<void>
  }
): Promise<ActorState> {
  const context = fullActorContext(actor)
  const tokenBudget = Math.min(input.tokenBudget, MAX_ACTOR_CONTEXT_TOKEN_BUDGET)
  for (let attempt = 1; attempt <= MAX_CONTEXT_COMPRESSION_ATTEMPTS; attempt += 1) {
    const prompt = withPromptLanguageGuide(
      `Compress memory for ${actor.name}. Return at most 3 short first-person lines.
${renderOutputLengthGuide(input.scenario.controls, "actor memory")}
Keep only actionable facts, pressure, commitment.

Profile: ${actor.role}; ${compactText(actor.personality, scalePromptLimit(100, input.scenario.controls))}; wants ${compactText(actor.preference, scalePromptLimit(120, input.scenario.controls))}.
Previous: ${compactText(actor.contextSummary || "None", scalePromptLimit(220, input.scenario.controls))}
Context:
${context ? compactLines(context.split("\n"), 5, scalePromptLimit(CONTEXT_COMPRESSION_INPUT_CHARS, input.scenario.controls)) : "No runtime context yet."}`,
      input.scenario.language
    )
    const result = await invokeRoleTextWithMetrics(input.settings, "actor", "context", attempt, prompt)
    await input.emit({
      type: "model.metrics",
      runId: input.runId,
      timestamp: timestamp(),
      metrics: result.metrics,
    })
    const summary = normalizeContextSummary(result.text, tokenBudget, input.scenario.controls)
    if (summary) {
      await input.emit({
        type: "model.message",
        runId: input.runId,
        timestamp: timestamp(),
        role: "actor",
        content: `${actor.name} context: ${compactText(summary, scalePromptLimit(CONTEXT_EVENT_CHARS, input.scenario.controls))}`,
      })
      return { ...actor, contextSummary: summary }
    }
    await input.emit({
      type: "log",
      runId: input.runId,
      timestamp: timestamp(),
      level: "warn",
      message: `actor.context for ${actor.id} returned empty text on attempt ${attempt}/${MAX_CONTEXT_COMPRESSION_ATTEMPTS}.`,
    })
  }

  throw new Error(`actor.context for ${actor.id} failed after ${MAX_CONTEXT_COMPRESSION_ATTEMPTS} empty responses.`)
}

export function applyInteractionContext(actors: ActorState[], interaction: Interaction): ActorState[] {
  const entry = contextEntry(interaction)
  return actors.map((actor) => {
    const receivesContext = shouldReceiveContext(actor.id, interaction)
    if (!receivesContext) {
      return actor
    }
    return {
      ...actor,
      context: appendContext(actor.context, interaction, entry),
      memory: [...actor.memory, entry].slice(-12),
    }
  })
}

export function applyPreRoundDigestContext(actors: ActorState[], digest: RoundDigest): ActorState[] {
  const entry = `pre-round ${digest.roundIndex}: ${digest.preRound.elapsedTime}. ${digest.preRound.content}`
  return actors.map((actor) => ({
    ...actor,
    context: {
      ...actor.context,
      public: [...actor.context.public, entry],
    },
    memory: [...actor.memory, entry].slice(-12),
  }))
}

function shouldReceiveContext(actorId: string, interaction: Interaction): boolean {
  if (interaction.visibility === "public") {
    return true
  }
  if (interaction.visibility === "semi-public" || interaction.visibility === "private") {
    return actorId === interaction.sourceActorId || interaction.targetActorIds.includes(actorId)
  }
  return actorId === interaction.sourceActorId
}

function appendContext(
  context: ActorContextMemory,
  interaction: Interaction,
  entry: string
): ActorContextMemory {
  if (interaction.visibility === "public") {
    return { ...context, public: [...context.public, entry] }
  }
  if (interaction.visibility === "semi-public") {
    return {
      ...context,
      semiPublic: {
        ...context.semiPublic,
        [interaction.id]: [...(context.semiPublic[interaction.id] ?? []), entry],
      },
    }
  }
  if (interaction.visibility === "private") {
    return {
      ...context,
      private: {
        ...context.private,
        [interaction.id]: [...(context.private[interaction.id] ?? []), entry],
      },
    }
  }
  return { ...context, solitary: [...context.solitary, entry] }
}

function contextEntry(interaction: Interaction): string {
  return `${interaction.visibility}: ${interaction.content} Intent: ${interaction.intent} Expectation: ${interaction.expectation}`
}

function fullActorContext(actor: ActorState): string {
  return [
    ...actor.context.public.map((entry) => `public: ${entry}`),
    ...Object.values(actor.context.semiPublic).flat().map((entry) => `semi-public: ${entry}`),
    ...Object.values(actor.context.private).flat().map((entry) => `private: ${entry}`),
    ...actor.context.solitary.map((entry) => `solitary: ${entry}`),
  ].join("\n")
}

function normalizeContextSummary(value: string, tokenBudget: number, controls: ScenarioControls): string {
  const trimmed = value.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim()
  const maxCharacters = Math.min(tokenBudget * 2, scalePromptLimit(CONTEXT_SUMMARY_CHARS, controls))
  return trimmed.length > maxCharacters ? trimmed.slice(0, maxCharacters).trim() : trimmed
}

function timestamp(): string {
  return new Date().toISOString()
}
