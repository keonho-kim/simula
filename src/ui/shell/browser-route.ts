/**
 * Purpose: Map browser paths to the existing simulation and report view state.
 * Pattern: Pure route projection.
 * Usage: Imported by App when restoring and changing browser views.
 * Related: src/ui/shell/App.tsx, src/ui/browser-storage/run-session.ts
 */
import type { RunSession } from "@/ui/browser-storage/run-session"

export type ViewMode = "home" | "simulation" | "report"

export function viewFromPath(pathname: string, session: RunSession): { viewMode: ViewMode; runId?: string } {
  if (pathname === "/simulation") return { viewMode: "simulation", runId: session.runId }
  const match = /^\/reports\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,199})$/.exec(pathname)
  if (match) return { viewMode: "report", runId: match[1] }
  return { viewMode: "home", runId: session.runId }
}

export function pathForView(viewMode: ViewMode, runId: string | undefined): string | undefined {
  if (viewMode === "home") return "/"
  if (viewMode === "simulation") return "/simulation"
  return runId ? `/reports/${encodeURIComponent(runId)}` : undefined
}
