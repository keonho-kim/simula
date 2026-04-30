import type {
  ActorContextMemory,
  ActorState,
  ActorVisibleContextEntry,
  InjectedEvent,
  Interaction,
  LLMSettings,
  RunEvent,
  ScenarioControls,
  ScenarioInput,
} from "@simula/shared"
import { invokeRoleTextWithMetrics } from "../llm"
import { withPromptLanguageGuide } from "../language"
import { compactLines, compactText, renderOutputLengthGuide, scalePromptLimit } from "../prompt"
import { DEFAULT_ACTOR_CONTEXT_TOKEN_BUDGET, MAX_ACTOR_CONTEXT_TOKEN_BUDGET } from "../settings"

const MAX_CONTEXT_COMPRESSION_ATTEMPTS = 5
const ACTOR_MEMORY_PROMPT_CHARS = 260
const ACTOR_RECENT_SECTION_CHARS = 360
const CONTEXT_COMPRESSION_INPUT_CHARS = 700
const CONTEXT_SUMMARY_CHARS = 520
const CONTEXT_EVENT_CHARS = 280
const MAX_RECENT_ITEMS_PER_SECTION = 4

export function emptyActorContext(): ActorContextMemory {
  return { visible: [] }
}

export function contextUsedByActor(actor: ActorState): string[] {
  return [
    actor.contextSummary ? `summary: ${actor.contextSummary}` : "",
    ...actor.context.visible.map(renderVisibleEntry),
  ].filter(Boolean).slice(-12)
}

export function actorPromptContext(actor: ActorState, controls?: ScenarioControls): string {
  const events = recentLines(actor, "event", controls)
  const ownActions = recentLines(actor, "out", controls, "self", (entry) => entry.decisionType !== "no_action")
  const incoming = recentLines(actor, "in", controls)
  const observed = recentLines(actor, "observed", controls)
  const memory = actor.contextSummary
    ? compactText(actor.contextSummary, scalePromptLimit(ACTOR_MEMORY_PROMPT_CHARS, controls))
    : "No compressed memory yet."

  return `Memory summary:
${memory}
Current and recent events:
${events}
Own recent actions:
${ownActions}
Incoming/direct messages:
${incoming}
Observed public activity:
${observed}`
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
  const context = actor.context.visible.map(renderVisibleEntry).join("\n")
  const tokenBudget = Math.min(input.tokenBudget, MAX_ACTOR_CONTEXT_TOKEN_BUDGET)
  for (let attempt = 1; attempt <= MAX_CONTEXT_COMPRESSION_ATTEMPTS; attempt += 1) {
    const prompt = withPromptLanguageGuide(
      `Compress memory for ${actor.name}. Return at most 3 short first-person lines.
${renderOutputLengthGuide(input.scenario.controls, "actor memory")}
Keep only actionable facts, pressure, commitment, and important promises.

Profile: ${actor.role}; ${compactText(actor.personality, scalePromptLimit(100, input.scenario.controls))}; wants ${compactText(actor.preference, scalePromptLimit(120, input.scenario.controls))}.
Previous: ${compactText(actor.contextSummary || "None", scalePromptLimit(220, input.scenario.controls))}
Visible history:
${context ? compactLines(context.split("\n"), 8, scalePromptLimit(CONTEXT_COMPRESSION_INPUT_CHARS, input.scenario.controls)) : "No visible runtime history yet."}`,
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

export function applyInjectedEventContext(actors: ActorState[], event: InjectedEvent): ActorState[] {
  const entry: ActorVisibleContextEntry = {
    id: event.id,
    kind: "event",
    roundIndex: event.roundIndex,
    eventId: event.sourceEventId,
    content: `${event.title}: ${event.summary}`,
  }
  return actors.map((actor) => appendVisibleEntry(actor, entry))
}

export function applyInteractionContext(actors: ActorState[], interaction: Interaction): ActorState[] {
  return actors.map((actor) => {
    const entry = visibleEntryForActor(actor.id, interaction)
    return entry ? appendVisibleEntry(actor, entry) : actor
  })
}

function visibleEntryForActor(actorId: string, interaction: Interaction): ActorVisibleContextEntry | undefined {
  const isSource = actorId === interaction.sourceActorId
  const isTarget = interaction.targetActorIds.includes(actorId)
  if (!isSource && !isTarget && interaction.visibility !== "public") {
    return undefined
  }
  if (interaction.visibility === "solitary" && !isSource) {
    return undefined
  }
  const kind = isSource
    ? interaction.targetActorIds.length > 0 ? "out" : "self"
    : isTarget ? "in" : "observed"
  return {
    id: `${interaction.id}:${actorId}`,
    kind,
    roundIndex: interaction.roundIndex,
    decisionType: interaction.decisionType,
    visibility: interaction.visibility,
    sourceActorId: interaction.sourceActorId,
    targetActorIds: interaction.targetActorIds,
    eventId: interaction.eventId,
    content: `${interaction.content} Intent: ${interaction.intent} Expectation: ${interaction.expectation}`,
  }
}

function appendVisibleEntry(actor: ActorState, entry: ActorVisibleContextEntry): ActorState {
  const visible = [...actor.context.visible, entry]
  return {
    ...actor,
    context: { visible },
    memory: visible.map(renderVisibleEntry).slice(-12),
  }
}

function recentLines(
  actor: ActorState,
  kind: ActorVisibleContextEntry["kind"],
  controls?: ScenarioControls,
  secondaryKind?: ActorVisibleContextEntry["kind"],
  predicate?: (entry: ActorVisibleContextEntry) => boolean
): string {
  const lines = actor.context.visible
    .filter((entry) => entry.kind === kind || entry.kind === secondaryKind)
    .filter((entry) => predicate?.(entry) ?? true)
    .slice(-MAX_RECENT_ITEMS_PER_SECTION)
    .map(renderVisibleEntry)
  return lines.length
    ? compactLines(lines, MAX_RECENT_ITEMS_PER_SECTION, scalePromptLimit(ACTOR_RECENT_SECTION_CHARS, controls))
    : "- None"
}

function renderVisibleEntry(entry: ActorVisibleContextEntry): string {
  return `${entry.kind.toUpperCase()} | ROUND ${entry.roundIndex} | ${entry.content}`
}

function normalizeContextSummary(value: string, tokenBudget: number, controls: ScenarioControls): string {
  const trimmed = value.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim()
  const maxCharacters = Math.min(tokenBudget * 2, scalePromptLimit(CONTEXT_SUMMARY_CHARS, controls))
  return trimmed.length > maxCharacters ? trimmed.slice(0, maxCharacters).trim() : trimmed
}

function timestamp(): string {
  return new Date().toISOString()
}
