/**
 * Purpose: Return an opened world to its source list or offer home navigation.
 * Pattern: Shared navigation composition.
 * Usage: Rendered in simulation, report preparation, and report result headers.
 * Related: src/ui/browser-storage/world-navigation.ts, src/ui/components/navigation/page-navigation.tsx
 */
import { PageNavigation } from "./page-navigation"
import type { UiTexts } from "@/ui/types/i18n"
import { readWorldVisit, restoreWorldList } from "@/ui/browser-storage/world-navigation"

export function RunNavigation({ runId, onHome, onBackToWorlds, t }: {
  runId?: string; onHome: () => void; onBackToWorlds?: () => void; t: UiTexts
}) {
  const canReturn = runId && onBackToWorlds && readWorldVisit()?.runId === runId
  if (!canReturn) return <PageNavigation kind="home" label={t.home} onClick={onHome} />
  return <PageNavigation kind="back" label={t.batchBackToWorlds} onClick={() => {
    if (restoreWorldList(runId)) onBackToWorlds()
  }} />
}
