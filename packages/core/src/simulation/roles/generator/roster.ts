import type { ActorRosterEntry, RunEvent } from "@simula/shared"
import { invokeRoleTextWithMetrics } from "../../../llm"
import { withRolePromptGuide } from "../../../language"
import { emitModelTelemetry } from "../../events"
import type { WorkflowState } from "../../state"

const MAX_ATTEMPTS = 5

export async function createActorRoster(
  state: WorkflowState,
  plannerDigest: string,
  emit: (event: RunEvent) => Promise<void>
): Promise<ActorRosterEntry[]> {
  const expectedCount = state.scenario.controls.numCast
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const prompt = withRolePromptGuide(renderRosterPrompt(expectedCount, plannerDigest, state.scenario.text), {
      language: state.scenario.language,
      settings: state.settings,
      role: "generator",
    })
    const result = await invokeRoleTextWithMetrics(state.settings, "generator", "roster", attempt, prompt)
    await emitModelTelemetry(state.runId, result, emit)

    try {
      const roster = parseActorRoster(result.text, expectedCount)
      await emitRosterMessage(state.runId, roster, emit)
      return roster
    } catch (error) {
      await emit({
        type: "log",
        runId: state.runId,
        timestamp: timestamp(),
        level: "warn",
        message: `generator.roster returned invalid roster on attempt ${attempt}/${MAX_ATTEMPTS}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      })
    }
  }

  throw new Error(`generator.roster failed after ${MAX_ATTEMPTS} invalid responses.`)
}

export function parseActorRoster(value: string, expectedCount: number): ActorRosterEntry[] {
  const semicolonEntries = parseSemicolonRoster(value)
  const entries = semicolonEntries.length ? semicolonEntries : parseLineRoster(value)

  if (entries.length !== expectedCount) {
    throw new Error(`expected ${expectedCount} roster entries but received ${entries.length}`)
  }

  validateUniqueRosterNames(entries)
  return entries
}

export function renderRosterPrompt(expectedCount: number, plannerDigest: string, scenarioText: string): string {
  return `Generator roster.
Return exactly one line with ${expectedCount} entries.
Format exactly: <name>: <short role>; <name>: <short role>; <name>: <short role>
Use exact person, organization, or line names that appear in the scenario.
If the scenario has a "Key Actors" or "주요 등장 인물" section, treat that section's bullet names as the authoritative actor candidates.
Prefer those named actor candidates over places, meetings, channels, topics, or abstract events.
Every actor must be a speaking-capable decision maker, stakeholder, organization unit, or accountable role.
Never use products, product lines, promotions, campaigns, events, offers, documents, channels, conditions, or metrics as actors.
Do not invent Korean names, generic placeholders, or new people when named scenario actors exist.
No JSON, markdown, headings, numbering, bullets, explanations, or line breaks.

Scenario:
${scenarioText}

Planner scenario digest:
${plannerDigest}`
}

function parseSemicolonRoster(value: string): ActorRosterEntry[] {
  return stripRosterPrefix(value)
    .split(";")
    .map((item) => parseRosterPair(item))
    .filter((entry): entry is Omit<ActorRosterEntry, "index"> => Boolean(entry))
    .map((entry, index) => ({ ...entry, index: index + 1 }))
}

function parseLineRoster(value: string): ActorRosterEntry[] {
  return stripRosterPrefix(value)
    .split("\n")
    .map((line) => parseRosterLine(line))
    .filter((entry): entry is Omit<ActorRosterEntry, "index"> => Boolean(entry))
    .map((entry, index) => ({ ...entry, index: index + 1 }))
}

async function emitRosterMessage(
  runId: string,
  roster: ActorRosterEntry[],
  emit: (event: RunEvent) => Promise<void>
): Promise<void> {
  await emit({
    type: "model.message",
    runId,
    timestamp: timestamp(),
    role: "generator",
    content: `roster: ${roster.map((entry) => `${entry.name} - ${entry.roleSeed}`).join("; ")}`,
  })
}

function validateUniqueRosterNames(entries: ActorRosterEntry[]): void {
  const seen = new Set<string>()
  for (const entry of entries) {
    const key = normalizeRosterName(entry.name)
    if (!key) {
      throw new Error("roster entry name is empty")
    }
    if (seen.has(key)) {
      throw new Error(`duplicate actor name: ${entry.name}`)
    }
    seen.add(key)
  }
}

function parseRosterLine(line: string): Omit<ActorRosterEntry, "index"> | undefined {
  const normalized = line
    .trim()
    .replace(/^\s*(?:[-*]\s*)?(?:\d+[.)]\s*)?/, "")
    .trim()
  if (!normalized) {
    return undefined
  }

  const match = normalized.match(/^(.+?)\s+(?:-|–|—|:)\s+(.+)$/)
  if (!match) {
    throw new Error(`invalid roster line: ${line.trim()}`)
  }
  const name = cleanRosterField(match[1] ?? "")
  const roleSeed = cleanRosterField(match[2] ?? "")
  if (!name || !roleSeed) {
    throw new Error(`invalid roster line: ${line.trim()}`)
  }
  return { name, roleSeed }
}

function parseRosterPair(value: string): Omit<ActorRosterEntry, "index"> | undefined {
  const normalized = value.trim()
  if (!normalized) {
    return undefined
  }

  const separatorIndex = normalized.search(/\s*[:：]\s*/)
  if (separatorIndex < 1) {
    return undefined
  }

  const name = cleanRosterField(normalized.slice(0, separatorIndex))
  const roleSeed = cleanRosterField(normalized.slice(separatorIndex + 1).replace(/^[:：]\s*/, ""))
  if (!name || !roleSeed) {
    return undefined
  }
  return { name, roleSeed }
}

function stripRosterPrefix(value: string): string {
  return value.trim().replace(/^\s*(?:generator\s+)?(?:actor\s+)?roster\s*[:：]\s*/i, "")
}

function cleanRosterField(value: string): string {
  return value.replace(/^["'“”‘’]+|["'“”‘’.,;]+$/g, "").trim()
}

function normalizeRosterName(value: string): string {
  return value.toLowerCase().replace(/[\s"'“”‘’.,:;()[\]{}_-]+/g, "")
}

function timestamp(): string {
  return new Date().toISOString()
}
