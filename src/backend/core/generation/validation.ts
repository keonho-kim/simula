/**
 * Purpose: Check that assembled generation output cites only supplied evidence.
 * Pattern: Pure output validation.
 * Usage: Called by bounded generation tasks shared across builders.
 * Related: src/backend/core/generation/tasks.ts
 */
export function assertEvidenceReferences(value: unknown, allowed: ReadonlySet<string>): void {
  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) { for (const child of value) assertEvidenceReferences(child, allowed); return }
  for (const [key, child] of Object.entries(value)) {
    if (key === "evidenceIds" && Array.isArray(child) && child.some(id => typeof id !== "string" || !allowed.has(id))) {
      throw new Error("Use only evidenceIds supplied for this task; do not invent references.")
    }
    assertEvidenceReferences(child, allowed)
  }
}
