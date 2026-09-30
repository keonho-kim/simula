/**
 * Purpose: Return an opened world to its source list or offer the normal home navigation.
 * Pattern: Shared navigation composition.
 * Usage: Rendered in simulation, report preparation, and report result headers.
 * Related: src/ui/browser-storage/world-navigation.ts, src/ui/shell/App.tsx
 */
import { ArrowLeftIcon, HomeIcon } from "lucide-react"
import { Button } from "@/ui/components/ui/button"
import type { UiTexts } from "@/ui/types/i18n"
import { readWorldVisit, restoreWorldList } from "@/ui/browser-storage/world-navigation"

export function RunNavigation({ runId, onHome, onBackToWorlds, t }: {
  runId?: string; onHome: () => void; onBackToWorlds?: () => void; t: UiTexts
}) {
  const canReturn = runId && onBackToWorlds && readWorldVisit()?.runId === runId
  if (!canReturn) return <Button aria-label={t.home} variant="ghost" size="icon" onClick={onHome}><HomeIcon /></Button>
  return <Button aria-label={t.batchBackToWorlds} title={t.batchBackToWorlds} variant="ghost" size="sm" onClick={() => {
    if (restoreWorldList(runId)) onBackToWorlds()
  }}><ArrowLeftIcon data-icon="inline-start" /><span className="hidden sm:inline">{t.batchBackToWorlds}</span></Button>
}
