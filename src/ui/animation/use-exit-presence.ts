/**
 * Purpose: Retain a controlled dialog briefly so its Motion exit can finish.
 * Pattern: Presence lifecycle hook.
 * Usage: Used by conditional landing and simulation dialogs.
 * Related: src/ui/components/ui/dialog.tsx, src/ui/shell/home-view.tsx, src/ui/animation/use-reduced-motion-preference.ts
 */
import { useEffect, useState } from "react"
import { useReducedMotionPreference } from "./use-reduced-motion-preference"
import { MOTION_SECONDS } from "./timing"

const DIALOG_EXIT_RETENTION_MS = MOTION_SECONDS.content * 1000

export function useExitPresence(open: boolean): boolean {
  const reducedMotion = useReducedMotionPreference()
  const [retained, setRetained] = useState(open)
  useEffect(() => {
    if (open) { setRetained(true); return }
    const timer = window.setTimeout(() => setRetained(false), reducedMotion ? 0 : DIALOG_EXIT_RETENTION_MS)
    return () => window.clearTimeout(timer)
  }, [open, reducedMotion])
  return open || retained
}
