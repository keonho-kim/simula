/**
 * Purpose: Map shared generation task kinds to scenario-builder reading stages.
 * Pattern: Pure presentation mapping.
 * Usage: Used by BuilderActivity.
 * Related: src/ui/models/generation/progress.ts
 */
import type { GenerationTaskView } from "@/ui/models/generation/progress"

export const BUILDER_STAGES = ["sources", "situation", "participants", "review"] as const
export function builderTaskStage(kind: GenerationTaskView["kind"]): typeof BUILDER_STAGES[number] {
  return kind === "evidence" || kind === "digest" ? "sources" : kind === "facet" || kind === "situation" ? "situation"
    : kind === "participant" || kind === "roster" ? "participants" : "review"
}
