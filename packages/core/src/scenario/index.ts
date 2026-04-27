import type { ScenarioControls, ScenarioInput } from "@simula/shared"

const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/

export function parseScenarioDocument(source: string, sourceName?: string): ScenarioInput {
  const match = source.match(FRONTMATTER_PATTERN)
  if (!match) {
    throw new Error("Scenario must start with a frontmatter block.")
  }

  const controls = parseScenarioControls(match[1] ?? "")
  const text = (match[2] ?? "").trim()
  if (!text) {
    throw new Error("Scenario body is required.")
  }

  return { sourceName, text, controls }
}

export function parseScenarioControls(frontmatter: string): ScenarioControls {
  const values = new Map<string, string>()
  for (const line of frontmatter.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }
    const separatorIndex = trimmed.indexOf(":")
    if (separatorIndex < 1) {
      throw new Error(`Invalid scenario control line: ${trimmed}`)
    }
    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()
    if (!["num_cast", "allow_additional_cast", "actions_per_type", "fast_mode"].includes(key)) {
      throw new Error(`Unsupported scenario control: ${key}`)
    }
    values.set(key, value)
  }

  const numCastRaw = values.get("num_cast")
  const numCast = Number(numCastRaw)
  if (!Number.isInteger(numCast) || numCast < 1) {
    throw new Error("num_cast must be a positive integer.")
  }

  return {
    numCast,
    allowAdditionalCast: parseBoolean(values.get("allow_additional_cast") ?? "true"),
    actionsPerType: parsePositiveInteger(values.get("actions_per_type") ?? "3", "actions_per_type"),
    fastMode: parseBoolean(values.get("fast_mode") ?? "false"),
  }
}

export function normalizeScenarioControls(controls: Partial<ScenarioControls>): ScenarioControls {
  return {
    numCast: parsePositiveInteger(String(controls.numCast), "num_cast"),
    allowAdditionalCast: controls.allowAdditionalCast ?? true,
    actionsPerType: parsePositiveInteger(String(controls.actionsPerType ?? 3), "actions_per_type"),
    fastMode: controls.fastMode ?? false,
  }
}

function parsePositiveInteger(value: string, name: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`)
  }
  return parsed
}

function parseBoolean(value: string): boolean {
  if (value === "true") {
    return true
  }
  if (value === "false") {
    return false
  }
  throw new Error("allow_additional_cast must be true or false.")
}
