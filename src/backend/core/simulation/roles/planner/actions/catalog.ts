import { parseJsonMarkdown } from "@langchain/core/output_parsers"
import { z } from "zod"
import type { ActionCatalog, ActionVisibility, ActorAction } from "@/shared"

export const ACTION_SCOPES = ["public", "semi-public", "private", "solitary"] as const
const prefixes: Record<ActionVisibility, string> = { public: "PUB", "semi-public": "GRP", private: "PRV", solitary: "SOL" }
const actionSchema = z.object({
  label: z.string().trim().min(1).max(40),
  intentHint: z.string().trim().min(1).max(200),
  expectedOutcome: z.string().trim().min(1).max(200),
}).strict()

export function parseAction(text: string, visibility: ActionVisibility, index: number, existing: ActionCatalog, language: "en" | "ko"): ActorAction {
  let decoded: unknown
  try { decoded = parseJsonMarkdown(text, JSON.parse) } catch { throw new Error("Return one valid JSON object with label, intentHint, expectedOutcome; no markdown or surrounding text.") }
  const parsed = actionSchema.safeParse(decoded)
  if (!parsed.success) throw new Error(parsed.error.issues.map(issue => `${issue.path.join(".") || "action"}: ${issue.message}`).join("; "))
  const fields = parsed.data
  if (/^(?:PUB|GRP|PRV|SOL)\d+$/i.test(fields.label) || /[<>]/.test(fields.label)) throw new Error("label: write an action name, not a code or placeholder.")
  if (/^(?:Public moves?|Semi-public exchange|Private encounter|Solitary reflection)\b/i.test(fields.label)) throw new Error("label: define a concrete action instead of a generic visibility label.")
  if (language === "ko") {
    const invalid = Object.entries(fields).filter(([, value]) => !/[가-힣]/.test(value)).map(([key]) => key)
    if (invalid.length) throw new Error(`${invalid.join(", ")}: 값은 한국어로 작성해야 합니다. JSON 키는 label, intentHint, expectedOutcome을 그대로 사용하세요.`)
  }
  const normalized = normalizeLabel(fields.label)
  if (!normalized) throw new Error("label: write a meaningful action name.")
  const collision = Object.values(existing).find(action => normalizeLabel(action.label) === normalized)
  if (collision) throw new Error(`label "${fields.label}" must be distinct; conflicts with ${collision.id} (${collision.visibility}) "${collision.label}". Choose a different mechanism, not spacing, punctuation, or numbering variants.`)
  return { id: `${prefixes[visibility]}${String(index + 1).padStart(2, "0")}`, visibility, ...fields }
}

function normalizeLabel(label: string): string {
  return label.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}\p{N}]/gu, "")
}
