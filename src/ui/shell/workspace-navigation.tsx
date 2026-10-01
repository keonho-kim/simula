/**
 * Purpose: Own browser history and let active editors guard backward navigation.
 * Pattern: Navigation lifecycle with an explicit editor contract.
 * Usage: App provides the guard registry; editor pages register their close workflow.
 * Related: src/ui/shell/browser-route.ts, src/ui/hooks/use-page-exit.ts
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { readRunSession, updateRunSession } from "@/ui/browser-storage/run-session"
import { pathForView, viewFromPath, type ViewMode } from "./browser-route"

import { type LeaveGuard } from "@/ui/hooks/editor-navigation-context"
export function useWorkspaceNavigation(selectedRunId: string | undefined, selectRun: (id: string) => void) {
  const [initialSession] = useState(() => ({ ...readRunSession(), ...viewFromPath(window.location.pathname, readRunSession()) }))
  const [viewMode, setViewMode] = useState<ViewMode>(initialSession.viewMode ?? "home")
  const viewModeRef = useRef(viewMode)
  const guardRef = useRef<LeaveGuard | undefined>(undefined)
  const index = useRef(0)
  const restoring = useRef(false)
  const approved = useRef(false)
  const currentPath = useRef(window.location.pathname)
  const registerGuard = useCallback((guard: LeaveGuard) => {
    guardRef.current = guard
    return () => { if (guardRef.current === guard) guardRef.current = undefined }
  }, [])
  useEffect(() => {
    const savedIndex = window.history.state?.simulaIndex
    index.current = typeof savedIndex === "number" ? savedIndex : 0
    window.history.replaceState({ ...window.history.state, simulaIndex: index.current }, "")
    const restore = () => {
      if (restoring.current) { restoring.current = false; return }
      const nextIndex = typeof window.history.state?.simulaIndex === "number" ? window.history.state.simulaIndex : 0
      const distance = nextIndex - index.current
      if (!approved.current && guardRef.current && distance) {
        restoring.current = true
        window.history.go(-distance)
        guardRef.current(() => { approved.current = true; window.history.go(distance) })
        return
      }
      approved.current = false
      index.current = nextIndex
      currentPath.current = window.location.pathname
      const route = viewFromPath(currentPath.current, readRunSession())
      if (route.runId) selectRun(route.runId)
      viewModeRef.current = route.viewMode
      setViewMode(route.viewMode)
    }
    window.addEventListener("popstate", restore)
    return () => window.removeEventListener("popstate", restore)
  }, [selectRun])
  useEffect(() => {
    viewModeRef.current = viewMode
    updateRunSession({ runId: selectedRunId, viewMode })
    const path = pathForView(viewMode, selectedRunId)
    if (!path || path === currentPath.current) return
    currentPath.current = path
    if (path === window.location.pathname) return
    index.current++
    window.history.pushState({ simulaIndex: index.current }, "", path)
  }, [viewMode, selectedRunId])
  return { initialSession, viewMode, setViewMode, viewModeRef, registerGuard }
}
