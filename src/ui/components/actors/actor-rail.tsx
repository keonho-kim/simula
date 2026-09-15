import { memo, useMemo } from "react"
import { useRunStore } from "@/ui/stores/run-store"
import { roundsThrough } from "@/ui/models/actors/conversation-data"
import type { UiTexts } from "@/ui/types/i18n"

import { VirtualActorHistory } from "@/ui/components/actors/history/virtual-history"

export const ActorRail = memo(function ActorRail({ t, onActorSelect }: { t: UiTexts; onActorSelect: (id: string) => void }) {
  const allRounds = useRunStore(state => state.conversationData.rounds)
  const selectedRunId = useRunStore(state => state.selectedRunId)
  const cutoff = useRunStore(state => state.replayIndex < state.timeline.length - 1 ? state.timeline[state.replayIndex]?.timestamp : undefined)
  const rounds = useMemo(() => roundsThrough(allRounds, cutoff), [allRounds, cutoff])

  return (
    <aside aria-labelledby="actor-rail-title" className="flex h-[720px] min-h-0 min-w-0 flex-col overflow-hidden xl:h-auto rounded-lg bg-card ring-1 ring-border/60">
      <header className="border-b border-border/60 px-5 py-4">
        <h2 id="actor-rail-title" className="text-sm font-semibold">{t.actorRailTitle}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t.actorRailDescription}</p>
      </header>
      <VirtualActorHistory key={selectedRunId} rounds={rounds} t={t} onActorSelect={onActorSelect} />
    </aside>
  )
})
