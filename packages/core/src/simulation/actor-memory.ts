import type {
  ActorContextMemory,
  ActorState,
  ActorVisibleContextEntry,
  InjectedEvent,
  Interaction,
  LLMSettings,
  PromptOutputLength,
  RunEvent,
  ScenarioControls,
  ScenarioInput,
} from "@simula/shared"
import { invokeRoleTextWithMetrics } from "../llm"
import { withRolePromptGuide } from "../language"
import { compactLines, compactText, resolvePromptOutputLength, scalePromptLimit } from "../prompt"
import { emitModelTelemetry } from "./events"

const MAX_CONTEXT_COMPRESSION_ATTEMPTS = 5
const ACTOR_MEMORY_PROMPT_CHARS = 260
const ACTOR_RECENT_SECTION_CHARS = 360
const CONTEXT_COMPRESSION_INPUT_CHARS = 700
const CONTEXT_SUMMARY_CHARS = 520
const CONTEXT_EVENT_CHARS = 280
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
  const context = actor.context.visible.map(renderVisibleEntry).join("\n")
  for (let attempt = 1; attempt <= MAX_CONTEXT_COMPRESSION_ATTEMPTS; attempt += 1) {
    const prompt = withRolePromptGuide(
      `Compress memory for ${actor.name}. ${renderActorMemoryLengthGuide(input.scenario.controls)}
Keep only actionable facts, pressure, commitment, and important promises.

Profile: ${actor.role}; ${compactText(actor.personality, scalePromptLimit(100, input.scenario.controls))}; wants ${compactText(actor.preference, scalePromptLimit(120, input.scenario.controls))}.
Previous: ${compactText(actor.contextSummary || "None", scalePromptLimit(220, input.scenario.controls))}
Visible history:
${context ? compactLines(context.split("\n"), 8, scalePromptLimit(CONTEXT_COMPRESSION_INPUT_CHARS, input.scenario.controls)) : "No visible runtime history yet."}`,
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

function normalizeContextSummary(value: string, controls: ScenarioControls): string {
  const trimmed = value.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim()
  const maxCharacters = scalePromptLimit(CONTEXT_SUMMARY_CHARS, controls)
  return trimmed.length > maxCharacters ? trimmed.slice(0, maxCharacters).trim() : trimmed
}

function timestamp(): string {
  return new Date().toISOString()
}
