import type { ActorContextMemory, ActorState, Interaction, LLMSettings, RoundDigest, RunEvent, ScenarioInput } from "@simula/shared"
import { invokeRoleTextWithMetrics } from "../llm"
import { withPromptLanguageGuide } from "../language"
import { DEFAULT_ACTOR_CONTEXT_TOKEN_BUDGET } from "../settings"

const MAX_CONTEXT_COMPRESSION_ATTEMPTS = 5

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

export function actorPromptContext(actor: ActorState): string {
  const recent = [
    ...actor.context.public.map((entry) => `public: ${entry}`),
    ...Object.values(actor.context.semiPublic).flat().map((entry) => `semi-public/private participant only: ${entry}`),
    ...Object.values(actor.context.private).flat().map((entry) => `private participant only: ${entry}`),
    ...actor.context.solitary.map((entry) => `solitary: ${entry}`),
  ].slice(-8)
  const recentContext = recent.length ? recent.join("\n") : "No runtime context yet."
  return actor.contextSummary
    ? `Compressed context: ${actor.contextSummary}
Recent context:
${recentContext}`
    : `Recent context:
${recentContext}`
}

export function resolveActorContextTokenBudget(scenario: ScenarioInput, settings: LLMSettings): number {
  return scenario.controls.actorContextTokenBudget ?? settings.actor.contextTokenBudget ?? DEFAULT_ACTOR_CONTEXT_TOKEN_BUDGET
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
  for (let attempt = 1; attempt <= MAX_CONTEXT_COMPRESSION_ATTEMPTS; attempt += 1) {
    const prompt = withPromptLanguageGuide(
      `Actor context compression for ${actor.name}.
Return a compact first-person memory summary for this actor in no more than ${input.tokenBudget} tokens.
Use only the context below. Preserve actionable facts, unresolved pressures, relationships, and commitments.
Do not add facts from other actors unless they are visible in this actor's context.

Actor role: ${actor.role}
Actor personality: ${actor.personality}
Actor preference: ${actor.preference}
Actor private goal: ${actor.privateGoal}
Previous compressed context: ${actor.contextSummary || "None"}
Visible context:
${context || "No runtime context yet."}`,
      input.scenario.language
    )
    const result = await invokeRoleTextWithMetrics(input.settings, "actor", "context", attempt, prompt)
    await input.emit({
      type: "model.metrics",
      runId: input.runId,
      timestamp: timestamp(),
      metrics: result.metrics,
    })
    const summary = normalizeContextSummary(result.text, input.tokenBudget)
    if (summary) {
      await input.emit({
        type: "model.message",
        runId: input.runId,
        timestamp: timestamp(),
        role: "actor",
        content: `${actor.name} context: ${summary}`,
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

function normalizeContextSummary(value: string, tokenBudget: number): string {
  const trimmed = value.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim()
  const maxCharacters = tokenBudget * 4
  return trimmed.length > maxCharacters ? trimmed.slice(0, maxCharacters).trim() : trimmed
}

function timestamp(): string {
  return new Date().toISOString()
}
