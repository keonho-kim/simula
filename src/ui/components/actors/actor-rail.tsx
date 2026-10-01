/**
 * Purpose: Present live actor rounds inside a fixed-height chat panel.
 * Pattern: Memoized presentation component.
 * Usage: Mounted beside SimulationStage by src/ui/shell/App.tsx.
 * Related: src/ui/components/actors/history/live-history.tsx
 */
import { memo, useMemo, useRef } from "react"
import { useActorProgress } from "@/ui/hooks/use-actor-progress"
import { reconcileLiveConversation } from "@/ui/models/actors/live-conversation"
import type { ActorRound } from "@/ui/models/actors/actor-conversation"
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
  const terminal = useRunStore(state => state.roundProgress.terminal?.type)
  const { snapshot, disconnected, liveUpdate } = useActorProgress(selectedRunId, cutoff === undefined && !terminal)
  const previous = useRef<{ runId?: string; rounds: ActorRound[] }>({ rounds: [] })
  const rounds = useMemo(() => {
    if (cutoff) return roundsThrough(allRounds, cutoff)
    const value = reconcileLiveConversation(previous.current.runId === selectedRunId ? previous.current.rounds : [], allRounds, snapshot && terminal ? { ...snapshot, status: terminal === "run.failed" ? "failed" : terminal === "run.canceled" ? "canceled" : "completed" } : snapshot)
    previous.current = { runId: selectedRunId, rounds: value }
    return value
  }, [allRounds, cutoff, selectedRunId, snapshot, terminal])

  return (
    <aside aria-labelledby="actor-rail-title" className={cn("flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg bg-card ring-1 ring-border/60", className)}>
      <header className="shrink-0 border-b border-border/60 px-5 py-3">
        <h2 id="actor-rail-title" className="text-sm font-semibold">{t.actorRailTitle}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t.actorRailDescription}</p>
      </header>
      {disconnected ? <p role="status" className="px-5 py-2 text-xs text-muted-foreground">{t.workspaceDisconnected}</p> : null}
      {snapshot?.status === "running" && !terminal && snapshot.turns.some(turn => turn.status !== "committed") ? <div className="actor-progress-status" role="status">
        <span>{t.workspacePreparing.replace("{round}", String(snapshot.roundIndex))}{snapshot.parallel ? ` · ${t.workspaceParallel}` : ""}</span>
        <span>{snapshot.turns.filter(turn => turn.status === "working").slice(0, 3).map(turn => turn.actorName).join(", ")}
          {snapshot.turns.some(turn => turn.status === "working") ? ` · ${t.workspaceWorking}` : ""}</span>
      </div> : null}
      <LiveActorHistory key={selectedRunId} animateNew={liveUpdate && !cutoff} rounds={rounds} t={t} onActorSelect={onActorSelect} overlayOpen={overlayOpen} />
    </aside>
  )
})
