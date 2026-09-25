/**
 * Purpose: Project accepted prose or live plain text without exposing object metadata.
 * Pattern: Pure shared projection.
 * Usage: Used by backend partial-output transport and browser accepted-task rendering.
 * Related: src/shared/generation.ts
 */
export interface GenerationPreviewField { key: string; text: string }

export function projectGenerationFields(value: unknown): GenerationPreviewField[] {
  if (typeof value === "string") return value.trim() ? [{ key: "content", text: value }] : []
  if (!value || typeof value !== "object" || Array.isArray(value)) return []
  const fields: GenerationPreviewField[] = []
  for (const [key, content] of Object.entries(value)) {
    if (["summary", "title", "purpose", "decision", "setting", "personality", "authority", "goal", "content", "rationale", "objective", "boundary", "horizon", "focus"].includes(key) && typeof content === "string") fields.push({ key, text: content })
    if (["assumptions", "gaps", "entries", "names", "claims", "issues", "findings", "categories"].includes(key) && Array.isArray(content)) {
      for (const child of content) {
        if (typeof child === "string") fields.push({ key, text: child })
        else if (child && typeof child === "object" && "text" in child && typeof child.text === "string") fields.push({ key, text: child.text })
        else if (child && typeof child === "object" && "description" in child && typeof child.description === "string") fields.push({ key, text: child.description })
      }
    }
  }
  return fields
}
