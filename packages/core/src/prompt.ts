import { plannerDigestSummary } from "./simulation/plan"
import type { PromptOutputLength, ScenarioControls, SimulationState } from "@simula/shared"

const OUTPUT_LENGTH_SCALE: Record<PromptOutputLength, number> = {
  short: 1,
  medium: 1.5,
  long: 2,
}

export function compactText(value: string | undefined, maxCharacters = 700): string {
  const compact = (value ?? "").replace(/\s+/g, " ").trim()
  if (compact.length <= maxCharacters) {
    return compact
  }
  return compact.slice(0, maxCharacters).replace(/\s+\S*$/, "").trim()
}

export function compactLines(lines: string[], maxLines = 6, maxCharacters = 700): string {
  const selected = lines
    .map((line) => compactText(line, Math.max(80, Math.floor(maxCharacters / Math.max(1, maxLines)))))
    .filter(Boolean)
    .slice(-maxLines)

  const compacted: string[] = []
  let remaining = maxCharacters
  for (const line of selected) {
    const newlineCost = compacted.length > 0 ? 1 : 0
    const budget = remaining - newlineCost
    if (budget <= 0) break
    const compactedLine = compactText(line, budget)
    if (!compactedLine) continue
    compacted.push(compactedLine)
    remaining -= newlineCost + compactedLine.length
  }

  return compacted.join("\n")
}

export function compactPlannerDigest(plan: SimulationState["plan"] | undefined, fallback: string, maxCharacters = 900): string {
  return compactText(plannerDigestSummary(plan, fallback), maxCharacters)
}

export function resolvePromptOutputLength(controls?: Partial<Pick<ScenarioControls, "outputLength">>): PromptOutputLength {
  const outputLength = controls?.outputLength
  return outputLength === "medium" || outputLength === "long" ? outputLength : "short"
}

export function scalePromptLimit(base: number, controls?: Partial<Pick<ScenarioControls, "outputLength">>): number {
  return Math.round(base * OUTPUT_LENGTH_SCALE[resolvePromptOutputLength(controls)])
}

export function renderOutputLengthGuide(
  controls?: Partial<Pick<ScenarioControls, "outputLength">>,
  kind = "output"
): string {
  const outputLength = resolvePromptOutputLength(controls)
  if (outputLength === "long") {
    return `Length for ${kind}: detailed. Prefer 3-6 short sentences, but avoid repetition.`
  }
  if (outputLength === "medium") {
    return `Length for ${kind}: moderate. Prefer 2-4 short sentences.`
  }
  return `Length for ${kind}: concise. Prefer 1-2 short sentences.`
}
