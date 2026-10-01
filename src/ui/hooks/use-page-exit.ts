/**
 * Purpose: Connect an editor's save/discard workflow to browser back and reload protection.
 * Pattern: Lifecycle navigation guard.
 * Usage: Called by scenario and settings editor pages.
 * Related: src/ui/shell/workspace-navigation.tsx
 */
import { useCallback, useContext, useEffect, useRef } from "react"
import { NavigationGuardContext } from "@/ui/hooks/editor-navigation-context"

export function usePageExit(active: boolean, dirty: boolean, onDirtyExit: () => void, blocked = false) {
  const register = useContext(NavigationGuardContext)
  const request = useRef(onDirtyExit)
  const pending = useRef<(() => void) | undefined>(undefined)
  useEffect(() => { request.current = onDirtyExit }, [onDirtyExit])
  useEffect(() => {
    if (!active || !register || (!dirty && !blocked)) return
    return register(continueNavigation => { if (blocked) return; pending.current = continueNavigation; request.current() })
  }, [active, dirty, blocked, register])
  useEffect(() => {
    if (!active || !dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [active, dirty])
  const exit = useCallback((fallback: () => void) => {
    const next = pending.current
    pending.current = undefined
    if (next) next()
    else fallback()
  }, [])
  const cancelExit = useCallback(() => { pending.current = undefined }, [])
  return { exit, cancelExit }
}
