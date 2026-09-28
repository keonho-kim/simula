/**
 * Purpose: Retain the selected run and view within one browser tab.
 * Pattern: Session storage adapter.
 * Usage: Read by browser route restoration and round progression.
 * Related: src/ui/shell/browser-route.ts, src/ui/hooks/use-round-progression.ts
 */
export interface RunSession {
  runId?: string
  viewMode?: "home" | "board" | "simulation" | "report" | "report-preparation"
  autoContinue?: boolean
  handledRounds?: number[]
  automaticStreak?: number
}
const key = "simula.run-session"
export function readRunSession(): RunSession {
  if (typeof window === "undefined") return {}
  const saved = sessionStorage.getItem(key)
  return saved ? JSON.parse(saved) as RunSession : {}
}
export function updateRunSession(update: RunSession): void {
  sessionStorage.setItem(key, JSON.stringify({ ...readRunSession(), ...update }))
}
