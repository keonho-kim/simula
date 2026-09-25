/**
 * Purpose: Maintain visible actor history and compress accumulated memory.
 * Pattern: State projection and model invocation.
 * Usage: Called by the actor memory lifecycle before model invocation.
 * Related: src/backend/core/simulation/roles/coordinator/actor-round.ts, src/backend/core/simulation/actors/prompts/compress-memory.ts
 */
import { compressMemory } from "./prompts/compress-memory"
import { activeMemoryRecords } from "./memory-records"
import { retainActorMemory } from "./retain-memory"
import type { ActorContextMemory, ActorState, ActorVisibleContextEntry, InjectedEvent, Interaction, LLMSettings, PromptOutputLength, RunEvent, ScenarioControls, ScenarioInput } from "@/shared"
import { invokeRoleTextWithMetrics } from "@/backend/integrations/llm"
import { withRolePromptGuide } from "@/backend/core/prompts/language"
import { compactLines, compactText, resolvePromptOutputLength, scalePromptLimit } from "@/backend/core/prompts/prompt"
import { emitModelTelemetry } from "@/backend/core/simulation/events/telemetry"
import { eventVisibleToActor } from "@/backend/core/simulation/events/injection"

const ACTOR_MEMORY_PROMPT_CHARS = 260

const ACTOR_RECENT_SECTION_CHARS = 360

const MAX_RECENT_ITEMS_PER_SECTION = 4

const ACTOR_MEMORY_SENTENCE_LIMITS: Record<PromptOutputLength, number> = {
  short: 3,
  medium: 5,
  long: 10,
}

export function emptyActorContext(): ActorContextMemory {
  return { visible: [] }
}

export function contextUsedByActor(actor: ActorState): string[] {
  const recent = [
    actor.contextSummary ? `summary: ${actor.contextSummary}` : "",
    ...actor.context.visible.map(renderVisibleEntry),
  ].filter(Boolean).slice(-12)
  return [...activeMemoryRecords(actor.context.ledger).map(record => `${record.kind}: ${record.quote}`), ...recent]
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
Retained source-quoted records (statements, not independently verified facts):
${JSON.stringify(activeMemoryRecords(actor.context.ledger).map(record => ({ kind: record.kind, quote: record.quote,
  speaker: record.sourceActorName ?? record.sourceActorId, round: record.roundIndex })))}
Current and recent events:
${events}
Own recent actions:
${ownActions}
Incoming/direct messages:
${incoming}
Observed public activity:
${observed}`
}

export function actorMemorySentenceLimit(controls?: Partial<Pick<ScenarioControls, "outputLength">>): number {
  return ACTOR_MEMORY_SENTENCE_LIMITS[resolvePromptOutputLength(controls)]
}

export function renderActorMemoryLengthGuide(controls?: Partial<Pick<ScenarioControls, "outputLength">>): string {
  return `Return at most ${actorMemorySentenceLimit(controls)} short first-person sentences.`
}

export function applyInjectedEventContext(actors: ActorState[], event: InjectedEvent): ActorState[] {
  const entry: ActorVisibleContextEntry = {
    id: event.id,
    kind: "event",
    roundIndex: event.roundIndex,
    eventId: event.sourceEventId,
    content: `${event.title}: ${event.summary}`,
  }
  return actors.map((actor) => eventVisibleToActor(event, actor.id) ? appendVisibleEntry(actor, entry) : actor)
}

export function applyInteractionContext(actors: ActorState[], interaction: Interaction): ActorState[] {
  const sourceName = actors.find(actor => actor.id === interaction.sourceActorId)?.name
  return actors.map((actor) => {
    const entry = visibleEntryForActor(actor.id, interaction, sourceName)
    return entry ? appendVisibleEntry(actor, entry) : actor
  })
}

function visibleEntryForActor(actorId: string, interaction: Interaction, sourceName: string | undefined): ActorVisibleContextEntry | undefined {
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
    interactionId: interaction.id,
    kind,
    roundIndex: interaction.roundIndex,
    decisionType: interaction.decisionType,
    visibility: interaction.visibility,
    sourceActorId: interaction.sourceActorId,
    sourceActorName: sourceName,
    targetActorIds: interaction.targetActorIds,
    eventId: interaction.eventId,
    // Visibility grants access to the accepted action, not to its author's internal motives.
    content: isSource
      ? `${interaction.content} Intent: ${interaction.intent} Expectation: ${interaction.expectation}`
      : interaction.content,
  }
}

function appendVisibleEntry(actor: ActorState, entry: ActorVisibleContextEntry): ActorState {
  const visible = [...actor.context.visible, entry]
  return {
    ...actor,
    context: { ...actor.context, visible },
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

const MAX_CONTEXT_COMPRESSION_ATTEMPTS = 5

const CONTEXT_SUMMARY_CHARS = 520

const CONTEXT_EVENT_CHARS = 280

export async function compressActorContext(
  actor: ActorState,
  input: {
    runId: string
    scenario: ScenarioInput
    settings: LLMSettings
    roundIndex: number
    emit: (event: RunEvent) => Promise<void>
  }
): Promise<ActorState> {
  actor = await retainActorMemory(actor, input)
  const context = actor.context.visible.map(renderVisibleEntry).join("\n")
  for (let attempt = 1; attempt <= MAX_CONTEXT_COMPRESSION_ATTEMPTS; attempt += 1) {
    const prompt = withRolePromptGuide(
      compressMemory(actor, context, input.scenario.controls, renderActorMemoryLengthGuide(input.scenario.controls)),
      {
        language: input.scenario.language,
        settings: input.settings,
        role: "actor",
      }
    )
    const result = await invokeRoleTextWithMetrics(input.settings, "actor", "context", attempt, prompt)
    await emitModelTelemetry(input.runId, result, input.emit, { actorId: actor.id, actorName: actor.name })
    const summary = normalizeContextSummary(result.text, input.scenario.controls)
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

function normalizeContextSummary(value: string, controls: ScenarioControls): string {
  const trimmed = value.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim()
  const maxCharacters = scalePromptLimit(CONTEXT_SUMMARY_CHARS, controls)
  return trimmed.length > maxCharacters ? trimmed.slice(0, maxCharacters).trim() : trimmed
}

function timestamp(): string {
  return new Date().toISOString()
}
