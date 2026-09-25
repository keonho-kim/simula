/**
 * Purpose: Accept short action fields and assign stable scope-specific codes.
 * Pattern: Simple Module.
 * Usage: Called by the Planner action-catalog node after each model field completes.
 * Related: src/backend/core/simulation/roles/planner/actions/node.ts
 */
import type { ActionCatalog, ActionVisibility, ActorAction } from "@/shared"

export const ACTION_SCOPES = ["public", "semi-public", "private", "solitary"] as const
export const ACTION_FIELDS = ["label", "intentHint", "expectedOutcome"] as const
export type ActionField = typeof ACTION_FIELDS[number]
const MAX_ACTION_LABEL_CHARS = 40
const MAX_LONG_ENGLISH_LABEL_CHARS = 32
const MAX_ACTION_DETAIL_CHARS = 200
const prefixes: Record<ActionVisibility, string> = { public: "PUB", "semi-public": "GRP", private: "PRV", solitary: "SOL" }

export class ActionLabelCollision extends Error {
  constructor(readonly label: string, readonly existingAction: ActorAction) {
    super(`label "${label}" must be distinct; conflicts with ${existingAction.id} (${existingAction.visibility}) "${existingAction.label}". Choose a different mechanism, not spacing, punctuation, or numbering variants.`)
    this.name = "ActionLabelCollision"
  }
}

export function acceptActionLabel(text: string, existing: ActionCatalog): string {
  const label = boundedLabel(text)
  if (!label) throw new Error("label: write one complete action name.")
  if (/^(?:PUB|GRP|PRV|SOL)\d+$/i.test(label) || /[<>]/.test(label)) throw new Error("label: write an action name, not a code or placeholder.")
  if (/^(?:Public moves?|Semi-public exchange|Private encounter|Solitary reflection)\b/i.test(label)) throw new Error("label: define a concrete action instead of a generic visibility label.")
  const normalized = normalizeLabel(label)
  if (!normalized) throw new Error("label: write a meaningful action name.")
  const collision = Object.values(existing).find(action => normalizeLabel(action.label) === normalized)
  if (collision) throw new ActionLabelCollision(label, collision)
  return label
}

export function acceptActionDetail(text: string, field: "intentHint" | "expectedOutcome"): string {
  const value = boundedText(text.trim(), MAX_ACTION_DETAIL_CHARS)
  if (!value) throw new Error(`${field}: write one complete sentence.`)
  return value
}

export function assembleAction(fields: Pick<ActorAction, "label" | "intentHint" | "expectedOutcome">,
  visibility: ActionVisibility, index: number): ActorAction {
  return { id: `${prefixes[visibility]}${String(index + 1).padStart(2, "0")}`, visibility, ...fields }
}

function boundedLabel(value: string): string {
  const firstSentence = value.trim().split(/[.!?。\n]/, 1)[0] ?? ""
  if (firstSentence.length <= MAX_ACTION_LABEL_CHARS) return firstSentence
  if (/[가-힣]/.test(firstSentence)) return boundedText(firstSentence, MAX_ACTION_LABEL_CHARS)
  return boundedText(firstSentence, MAX_LONG_ENGLISH_LABEL_CHARS)
    .replace(/\s+(?:of|for|to|with|on|in|at|by|about|against|from|under|and|or)$/i, "")
}

function boundedText(value: string, limit: number): string {
  if (value.length <= limit) return value.trim()
  const prefix = value.slice(0, limit)
  const lastSpace = prefix.lastIndexOf(" ")
  return (lastSpace >= Math.floor(limit / 3) ? prefix.slice(0, lastSpace) : prefix).trim()
}

function normalizeLabel(label: string): string {
  return label.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}\p{N}]/gu, "")
}

/** Disambiguate visibility without inventing an action or changing its condition/effect. */
export function recoverScopedLabel(collision: ActionLabelCollision, visibility: ActionVisibility,
  catalog: ActionCatalog, language: "en" | "ko"): string | undefined {
  if (visibility === collision.existingAction.visibility) return undefined
  const names = language === "ko"
    ? { public: "공개", "semi-public": "그룹", private: "개인", solitary: "혼자" }
    : { public: "Public", "semi-public": "Group", private: "Private", solitary: "Solo" }
  const prefix = `${names[visibility]} · `
  try { return acceptActionLabel(prefix + collision.label.slice(0, MAX_ACTION_LABEL_CHARS - prefix.length), catalog) }
  catch (error) { if (error instanceof ActionLabelCollision) return undefined; throw error }
}
