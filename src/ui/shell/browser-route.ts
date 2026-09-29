/**
 * Purpose: Map browser paths to home, preparation, simulation, and report views.
 * Pattern: Pure route projection.
 * Usage: Imported by App when restoring and changing browser views.
 * Related: src/ui/shell/App.tsx, src/ui/browser-storage/run-session.ts
 */
import type { RunSession } from "@/ui/browser-storage/run-session"

export type ViewMode = NonNullable<RunSession["viewMode"]>

export function viewFromPath(pathname: string, session: RunSession): { viewMode: ViewMode; runId?: string } {
  if (pathname === "/document-analysis") return { viewMode: "document-analysis" }
  if (pathname === "/scenario-board") return session.runId ? { viewMode: "board", runId: session.runId } : { viewMode: "home" }
  if (pathname === "/simulation") return { viewMode: "simulation", runId: session.runId }
  const match = /^\/reports\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,199})(\/prepare)?$/.exec(pathname)
  if (match) return { viewMode: match[2] ? "report-preparation" : "report", runId: match[1] }
  return { viewMode: "home", runId: session.runId }
}

export function pathForView(viewMode: ViewMode, runId: string | undefined): string | undefined {
  if (viewMode === "document-analysis") return "/document-analysis"
  if (viewMode === "home") return "/"
  if (viewMode === "board") return runId ? "/scenario-board" : undefined
  if (viewMode === "simulation") return "/simulation"
  return runId ? `/reports/${encodeURIComponent(runId)}${viewMode === "report-preparation" ? "/prepare" : ""}` : undefined
}
