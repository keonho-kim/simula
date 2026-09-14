import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { cancelRun, continueRun } from "@/ui/api/client"
import { useRunStore } from "@/ui/stores/run-store"
import { selectCompletedRound, selectTerminalEvent } from "@/ui/stores/run/selectors"
import type { UiTexts } from "@/ui/types/i18n"

export function useRoundProgression(selectedRunId: string | undefined, t: UiTexts) {
  const completedRound = useRunStore(selectCompletedRound)
  const terminalEvent = useRunStore(selectTerminalEvent)
  const [autoContinue, setAutoContinue] = useState(false)
  const [roundPromptIndex, setRoundPromptIndex] = useState<number>()
  const [roundAction, setRoundAction] = useState<"continue" | "cancel">()
  const [handledRounds, setHandledRounds] = useState(() => new Set<number>())

  const resetRoundProgression = useCallback(() => {
    setRoundPromptIndex(undefined)
    setHandledRounds(new Set())
  }, [])

  useEffect(() => {
    if (terminalEvent) setRoundPromptIndex(undefined)
  }, [terminalEvent])

  useEffect(() => {
    if (selectedRunId && roundPromptIndex === undefined && completedRound !== undefined && !handledRounds.has(completedRound)) {
      setRoundPromptIndex(completedRound)
    }
  }, [selectedRunId, roundPromptIndex, completedRound, handledRounds])

  const continueRound = useCallback(async () => {
    if (!selectedRunId || roundPromptIndex === undefined) return
    const roundIndex = roundPromptIndex
    setRoundAction("continue")
    try {
      setHandledRounds(current => new Set(current).add(roundIndex))
      setRoundPromptIndex(undefined)
      await continueRun(selectedRunId, roundIndex)
    } catch (error) {
      setHandledRounds(current => {
        const next = new Set(current)
        next.delete(roundIndex)
        return next
      })
      setRoundPromptIndex(roundIndex)
      setAutoContinue(false)
      toast.error(error instanceof Error ? error.message : t.roundContinueFailed)
    } finally {
      setRoundAction(undefined)
    }
  }, [selectedRunId, roundPromptIndex, t.roundContinueFailed])

  const cancelCurrentRun = useCallback(async () => {
    if (!selectedRunId) return
    setRoundAction("cancel")
    try {
      await cancelRun(selectedRunId)
      setRoundPromptIndex(undefined)
    } catch (error) {
      setAutoContinue(false)
      toast.error(error instanceof Error ? error.message : t.roundStopFailed)
    } finally {
      setRoundAction(undefined)
    }
  }, [selectedRunId, t.roundStopFailed])

  return { autoContinue, setAutoContinue, roundPromptIndex, roundAction, continueRound, cancelCurrentRun,
    resetRoundProgression, completed: terminalEvent?.type === "run.completed" }
}
