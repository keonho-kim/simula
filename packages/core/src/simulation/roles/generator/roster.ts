import type { ActorRosterEntry, RunEvent } from "@simula/shared"
import { invokeRoleTextWithMetrics } from "../../../llm"
import { withPromptLanguageGuide } from "../../../language"
import type { WorkflowState } from "../../state"

const MAX_ATTEMPTS = 5

export async function createActorRoster(
  state: WorkflowState,
  plannerDigest: string,
  emit: (event: RunEvent) => Promise<void>
): Promise<ActorRosterEntry[]> {
  const expectedCount = state.scenario.controls.numCast
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const prompt = withPromptLanguageGuide(renderRosterPrompt(expectedCount, plannerDigest), state.scenario.language)
    const result = await invokeRoleTextWithMetrics(state.settings, "generator", "roster", attempt, prompt)
    await emit({
      type: "model.metrics",
      runId: state.runId,
      timestamp: timestamp(),
      metrics: result.metrics,
    })

    try {
      const roster = parseActorRoster(result.text, expectedCount)
      await emit({
        type: "model.message",
        runId: state.runId,
        timestamp: timestamp(),
        role: "generator",
        content: `roster: ${roster.map((entry) => `${entry.name} - ${entry.roleSeed}`).join("; ")}`,
      })
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
  const entries = value
    .split("\n")
    .map((line) => parseRosterLine(line))
    .filter((entry): entry is Omit<ActorRosterEntry, "index"> => Boolean(entry))
    .map((entry, index) => ({ ...entry, index: index + 1 }))

  if (entries.length !== expectedCount) {
    throw new Error(`expected ${expectedCount} roster entries but received ${entries.length}`)
  }

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

  return entries
}

function renderRosterPrompt(expectedCount: number, plannerDigest: string): string {
  return `Generator actor roster.
Create exactly ${expectedCount} unique actor names with rough role seeds.
Return plain text only. Do not use JSON, markdown tables, headings, or explanations.
Format each line exactly as: <number>. <unique actor name> - <short role seed>
Names must not repeat or describe the same person twice.

Requested actors: ${expectedCount}
Planner scenario digest:
${plannerDigest}`
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

function cleanRosterField(value: string): string {
  return value.replace(/^["'“”‘’]+|["'“”‘’.,;]+$/g, "").trim()
}

function normalizeRosterName(value: string): string {
  return value.toLowerCase().replace(/[\s"'“”‘’.,:;()[\]{}_-]+/g, "")
}

function timestamp(): string {
  return new Date().toISOString()
}
