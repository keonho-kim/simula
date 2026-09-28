/**
 * Purpose: Present live actor rounds inside a fixed-height chat panel.
 * Pattern: Memoized presentation component.
 * Usage: Mounted beside SimulationStage by src/ui/shell/App.tsx.
 * Related: src/ui/components/actors/history/live-history.tsx
 */
import { memo, useMemo } from "react"
import { useRunStore } from "@/ui/stores/run-store"
import { roundsThrough } from "@/ui/models/actors/conversation-data"
import type { UiTexts } from "@/ui/types/i18n"

import { LiveActorHistory } from "@/ui/components/actors/history/live-history"
import { cn } from "@/ui/lib/class-names"

export const ActorRail = memo(function ActorRail({ t, onActorSelect, className, overlayOpen = false }: {
  t: UiTexts; onActorSelect: (id: string) => void; className?: string; overlayOpen?: boolean
}) {
  const allRounds = useRunStore(state => state.conversationData.rounds)
  const selectedRunId = useRunStore(state => state.selectedRunId)
  const cutoff = useRunStore(state => state.replayIndex < state.timeline.length - 1 ? state.timeline[state.replayIndex]?.timestamp : undefined)
  const rounds = useMemo(() => roundsThrough(allRounds, cutoff), [allRounds, cutoff])

  return (
    <aside aria-labelledby="actor-rail-title" className={cn("flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg bg-card ring-1 ring-border/60", className)}>
      <header className="shrink-0 border-b border-border/60 px-5 py-3">
        <h2 id="actor-rail-title" className="text-sm font-semibold">{t.actorRailTitle}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t.actorRailDescription}</p>
      </header>
      <LiveActorHistory key={selectedRunId} rounds={rounds} t={t} onActorSelect={onActorSelect} overlayOpen={overlayOpen} />
    </aside>
  )
})
