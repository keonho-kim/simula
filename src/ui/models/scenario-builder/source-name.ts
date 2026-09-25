/**
 * Purpose: Name the browser-authored situation source without exposing its internal file artifact.
 * Pattern: Presentation mapping.
 * Usage: Used by scenario setup, live progress, and source review.
 * Related: src/ui/hooks/use-document-scenario.ts, src/ui/components/scenario-builder/source-evidence.tsx
 */
import type { UiTexts } from "@/ui/types/i18n"

export const USER_SITUATION_SOURCE_NAME = "user-situation.txt"

export function scenarioSourceName(name: string, t: UiTexts): string {
  return name === USER_SITUATION_SOURCE_NAME ? t.builderEnteredSituation : name
}
