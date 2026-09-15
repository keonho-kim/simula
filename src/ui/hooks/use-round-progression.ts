import { readRunSession, updateRunSession } from "@/ui/storage/run-session"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { cancelRun, continueRun } from "@/ui/api/client"
import { useRunStore } from "@/ui/stores/run-store"
import { selectCompletedRound, selectTerminalEvent } from "@/ui/stores/run/selectors"
import type { UiTexts } from "@/ui/types/i18n"

export function useRoundProgression(selectedRunId: string | undefined, t: UiTexts) {
  const completedRound = useRunStore(selectCompletedRound)
  const terminalEvent = useRunStore(selectTerminalEvent)
  const [autoContinue, setAutoContinueState] = useState(() => readRunSession().autoContinue ?? false)
  const [automaticStreak, setAutomaticStreak] = useState(() => readRunSession().automaticStreak ?? 0)
  const autoContinueRef = useRef(autoContinue)
  const inFlight = useRef(false)
  const skipRoundDelay = autoContinue && automaticStreak >= 3
  const setAutoContinue = useCallback((enabled: boolean) => {
    autoContinueRef.current = enabled
    setAutoContinueState(enabled)
    if (!enabled) setAutomaticStreak(0)
  }, [])
  const [roundPromptIndex, setRoundPromptIndex] = useState<number>()
  const [roundAction, setRoundAction] = useState<"continue" | "cancel">()
  const [handledRounds, setHandledRounds] = useState(() => new Set<number>(readRunSession().handledRounds ?? []))

  useEffect(() => {
    if (selectedRunId) updateRunSession({ runId: selectedRunId, autoContinue, ...(!roundAction ? { handledRounds: [...handledRounds], automaticStreak } : {}) })
  }, [selectedRunId, autoContinue, handledRounds, roundAction, automaticStreak])

  const resetRoundProgression = useCallback(() => {
    setRoundPromptIndex(undefined)
    setHandledRounds(new Set())
    setAutomaticStreak(0)
  }, [])

  useEffect(() => {
    if (terminalEvent) setRoundPromptIndex(undefined)
  }, [terminalEvent])

  useEffect(() => {
    if (!roundAction && selectedRunId && roundPromptIndex === undefined && completedRound !== undefined && !handledRounds.has(completedRound)) {
      setRoundPromptIndex(completedRound)
    }
  }, [selectedRunId, roundPromptIndex, completedRound, handledRounds, roundAction])

  const continueRound = useCallback(async () => {
    if (!selectedRunId || roundPromptIndex === undefined || inFlight.current) return
    inFlight.current = true
    const automatic = autoContinueRef.current
    const roundIndex = roundPromptIndex
    setRoundAction("continue")
    try {
      setHandledRounds(current => new Set(current).add(roundIndex))
      setRoundPromptIndex(undefined)
      await continueRun(selectedRunId, roundIndex)
      const countAutomatic = automatic && autoContinueRef.current
      setAutomaticStreak(current => countAutomatic ? Math.min(3, current + 1) : 0)
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
      inFlight.current = false
      setRoundAction(undefined)
    }
  }, [selectedRunId, roundPromptIndex, setAutoContinue, t.roundContinueFailed])

  useEffect(() => {
    if (skipRoundDelay && roundPromptIndex !== undefined && !roundAction && !terminalEvent) void continueRound()
  }, [skipRoundDelay, roundPromptIndex, roundAction, terminalEvent, continueRound])

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
  }, [selectedRunId, setAutoContinue, t.roundStopFailed])

  return { autoContinue, setAutoContinue, skipRoundDelay, roundPromptIndex, roundAction, continueRound, cancelCurrentRun,
    resetRoundProgression, completed: terminalEvent?.type === "run.completed" }
}
