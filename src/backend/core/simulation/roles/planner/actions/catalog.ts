import type { ActionCatalog, ActionVisibility, ActorAction } from "@/shared"

export const ACTION_SCOPES = ["public", "semi-public", "private", "solitary"] as const
const prefixes: Record<ActionVisibility, string> = { public: "PUB", "semi-public": "GRP", private: "PRV", solitary: "SOL" }

export function parseActionBatch(text: string, visibility: ActionVisibility, offset: number, count: number, existing: ActionCatalog, language: "en" | "ko"): ActorAction[] {
  const body = text.trim().replace(/^```(?:text)?\s*\n([\s\S]*?)\n```$/i, "$1")
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length !== count) throw new Error(`Expected ${count} action lines, received ${lines.length}.`)
  const labels = new Set(Object.values(existing).map((action) => normalizeLabel(action.label)))
  return lines.map((line, index) => {
    const fields = line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "").split("|").map((field) => field.trim())
    if (fields.length !== 3 || fields.some((field) => !field)) throw new Error("Each line must contain exactly: label | usage condition | expected effect.")
    const [label, intentHint, expectedOutcome] = fields as [string, string, string]
    if (/^(?:PUB|GRP|PRV|SOL)\d+$/i.test(label) || /[<>]/.test(label)) throw new Error("Write an action name, not a code or placeholder.")
    if (label.length > 40 || intentHint.length > 200 || expectedOutcome.length > 200) throw new Error("Use a short label (40 characters max) and short conditions/effects (200 each max).")
    if (/^(?:Public moves?|Semi-public exchange|Private encounter|Solitary reflection)\b/i.test(label)) throw new Error("Define a concrete action instead of a generic visibility label.")
    if (language === "ko" && fields.some((field) => !/[가-힣]/.test(field))) throw new Error("Action labels, conditions, and effects must be written in Korean.")
    const normalized = normalizeLabel(label)
    if (!normalized || labels.has(normalized)) throw new Error(`Action label must be distinct: ${label}`)
    labels.add(normalized)
    return { id: `${prefixes[visibility]}${String(offset + index + 1).padStart(2, "0")}`, visibility, label, intentHint, expectedOutcome }
  })
}

function normalizeLabel(label: string): string {
  return label.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}\p{N}]/gu, "")
}
