import { useMemo } from "react"
import { useRunStore } from "@/ui/stores/run-store"
import type { UiTexts } from "@/ui/types/i18n"
import { buildActorNameMap, buildActorHistory, buildActorReasoning, buildActorSummaries, type ActorSummary, type ActorHistoryItem, type ActorReasoningItem } from "@/ui/models/actors/actor-details"

export function useActorPanelData(t: UiTexts): { actors: ActorSummary[]; history: ActorHistoryItem[]; reasoning: ActorReasoningItem[] } {
  const timeline = useRunStore((state) => state.timeline)
  const replayIndex = useRunStore((state) => state.replayIndex)
  const actorEvents = useRunStore((state) => state.actorEvents)
  const runState = useRunStore((state) => state.runState)
  const frame = timeline[replayIndex] ?? timeline.at(-1)
  const actorNames = useMemo(() => buildActorNameMap(frame?.nodes ?? [], actorEvents, runState?.actors ?? []), [actorEvents, frame, runState?.actors])
  const history = useMemo(
    () => buildActorHistory(actorEvents, runState?.interactions ?? [], actorNames, t, runState?.actors ?? []),
    [actorEvents, actorNames, runState?.actors, runState?.interactions, t]
  )
  const reasoning = useMemo(() => buildActorReasoning(actorEvents), [actorEvents])
  const actors = useMemo(
    () => buildActorSummaries(runState?.actors ?? [], frame?.nodes ?? [], actorEvents, history),
    [actorEvents, frame?.nodes, history, runState?.actors]
  )
  return { actors, history, reasoning }
}
